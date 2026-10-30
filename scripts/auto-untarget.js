const MOD_ID = "auto-untarget";
const processedWorkflows = new WeakSet();

Hooks.once("init", () => {
  game.settings.register(MOD_ID, "debug", {
    name: "Debug logging",
    hint: "Write extra logs and toasts.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
});

function debugEnabled() {
  try {
    return game.settings.get(MOD_ID, "debug");
  } catch (_error) {
    return false;
  }
}

function dbg(...args) {
  if (debugEnabled()) console.log(`[${MOD_ID}]`, ...args);
}

function warn(...args) {
  console.warn(`[${MOD_ID}]`, ...args);
}

function toast(message) {
  if (debugEnabled()) ui.notifications?.info(message);
}

function tokenId(token) {
  return token?.id ?? token?.document?.id ?? null;
}

function idsMatch(left, right) {
  if (left.size !== right.size) return false;
  for (const id of left) {
    if (!right.has(id)) return false;
  }
  return true;
}

/**
 * Clear the current user's targets without touching another user's target set.
 * The token list is copied first because setTarget mutates user.targets.
 */
function clearTargetsForUser(user, reason = "") {
  try {
    const targetUser = user ?? game.user;
    if (!targetUser) return;

    const before = new Set(Array.from(targetUser.targets ?? []).map(tokenId).filter(Boolean));
    for (const token of Array.from(targetUser.targets ?? [])) {
      try {
        token?.setTarget?.(false, {
          user: targetUser,
          releaseOthers: false,
          groupSelection: false
        });
      } catch (_error) {
        // Continue clearing the remaining targets if one token rejects the update.
      }
    }

    // Fallback for tokens that remained marked as targeted for this user.
    for (const token of canvas?.tokens?.placeables ?? []) {
      if (token?.isTargeted && token?.targeted?.has?.(targetUser)) {
        try {
          token.setTarget(false, {
            user: targetUser,
            releaseOthers: false,
            groupSelection: false
          });
        } catch (_error) {
          // Best-effort fallback; the final state is reported below.
        }
      }
    }

    const after = new Set(Array.from(targetUser.targets ?? []).map(tokenId).filter(Boolean));
    dbg(`Cleared local targets ${reason}`, {
      before: [...before],
      after: [...after],
      user: targetUser.id
    });
  } catch (error) {
    console.error(`[${MOD_ID}] clearTargetsForUser error`, error);
  }
}

function handleWorkflow(workflow) {
  try {
    if (!workflow || processedWorkflows.has(workflow)) return;
    processedWorkflows.add(workflow);

    if (workflow.aborted) {
      dbg("RollComplete: aborted workflow; skipping.");
      return;
    }

    const workflowTargets = new Set(
      Array.from(workflow.targets ?? []).map(tokenId).filter(Boolean)
    );
    const targetCount = workflowTargets.size;
    const actorName = workflow.actor?.name;
    const itemName = workflow.item?.name ?? workflow.activity?.name;

    dbg(`RollComplete: actor=${actorName} item=${itemName} targets=${targetCount}`);

    // Preserve the original module behavior: single-target actions are untouched.
    if (targetCount <= 1) return;

    const user = game.user;
    if (!user) return;

    // Midi-QoL 14.6.5 restores the pre-workflow selection during postCleanup
    // only while the current selection still equals this workflow's targets.
    // Clear here, at RollComplete, to intentionally suppress that restoration.
    // If the current set differs, another targeting action may have occurred;
    // do not erase that newer selection.
    const currentTargets = new Set(
      Array.from(user.targets ?? []).map(tokenId).filter(Boolean)
    );

    if (!idsMatch(currentTargets, workflowTargets)) {
      dbg("RollComplete: current targets differ from workflow targets; preserving the newer selection.", {
        workflowTargets: [...workflowTargets],
        currentTargets: [...currentTargets]
      });
      return;
    }

    dbg("RollComplete: current selection still belongs to this multi-target workflow; clearing it.");
    toast("[Auto Untarget] Clearing targets (multi-target action).");
    clearTargetsForUser(user, "(RollComplete)");
  } catch (error) {
    console.error(`[${MOD_ID}] handleWorkflow error`, error);
  }
}

Hooks.once("ready", () => {
  if (!game.modules.get("midi-qol")?.active) {
    warn("Midi-QoL not active; module idle.");
    return;
  }

  // Midi-QoL 14.6.5 emits RollComplete before its postCleanup target restoration.
  // postCompleted and WorkflowComplete are not hooks emitted by this Midi-QoL build.
  Hooks.on("midi-qol.RollComplete", handleWorkflow);
  dbg("Loaded. Subscribed to midi-qol.RollComplete.");
});
