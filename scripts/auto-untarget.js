const MOD_ID = "auto-untarget";
const SOCKET_EVENT = "clear-targets-for-user";

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

function dbg(...a){ if (game.settings.get(MOD_ID,"debug")) console.log(`[${MOD_ID}]`, ...a); }
function warn(...a){ console.warn(`[${MOD_ID}]`, ...a); }
function toast(msg){ if (game.settings.get(MOD_ID,"debug")) ui.notifications?.info(msg); }

/** Robust local clear (do NOT rely on game.user.updateTokenTargets) */
function clearTargetsForUser(user, reason = "") {
  try {
    const u = user ?? game.user;
    if (!u) return;
    const before = Array.from(u.targets ?? []).map(t => t?.id);
    // Copy first, mert a Set iterálása közben módosul
    const myTargets = Array.from(u.targets ?? []);
    for (const t of myTargets) {
      try { t?.setTarget?.(false, { user: u, releaseOthers: false, groupSelection: false }); } catch(_e){}
    }
    // Biztonsági fallback: ha valami még mindig targetelt nekem
    for (const tok of canvas?.tokens?.placeables ?? []) {
      if (tok?.isTargeted && tok?.targeted?.has?.(u)) {
        try { tok.setTarget(false, { user: u, releaseOthers: false, groupSelection: false }); } catch(_e){}
      }
    }
    const after = Array.from(u.targets ?? []).map(t => t?.id);
    dbg(`Cleared local targets ${reason}`, { before, after, user: u.id });
  } catch (e) {
    console.error(`[${MOD_ID}] clearTargetsForUser error`, e);
  }
}

function getInitiatorUserId(wf) {
  // Több forrásból próbálunk olvasni
  return (
    wf?.userId ||
    wf?.user?.id ||
    wf?.workflow?.userId ||
    wf?.workflow?.user?.id ||
    // próbáljuk a kapcsolódó chat üzenetet (ha van)
    (wf?.itemCard?.message?.user?.id) ||
    (wf?.itemCard?.messageId && game.messages?.get?.(wf.itemCard.messageId)?.user?.id) ||
    null
  );
}

Hooks.once("ready", () => {
  // Socket listener
  game.socket?.on(`module.${MOD_ID}`, (data) => {
    try {
      if (!data || data.type !== SOCKET_EVENT || !data.userId) return;
      if (game.user.id !== data.userId) return; // csak a címzett
      dbg(`Socket received -> clear for me (${game.user.id})`, data);
      toast(`[Auto Untarget] Clearing targets (multi-target action).`);
      clearTargetsForUser(game.user, "(socket)");
    } catch (e) {
      console.error(`[${MOD_ID}] socket handler error`, e);
    }
  });

  if (!game.modules.get("midi-qol")?.active) {
    warn("Midi-QoL not active; module idle.");
    return;
  }

  dbg("Loaded. Subscribing Midi-QoL hooks: postCompleted, RollComplete, WorkflowComplete (fallbacks).");

  // Primer végállapot
  Hooks.on("midi-qol.postCompleted", handleWorkflow.bind(null, "postCompleted"));
  // Fallbackok
  Hooks.on("midi-qol.RollComplete", handleWorkflow.bind(null, "RollComplete"));
  Hooks.on("midi-qol.WorkflowComplete", handleWorkflow.bind(null, "WorkflowComplete"));
});

/** Core handler */
function handleWorkflow(source, wf) {
  try {
    if (!wf) return;
    if (wf.aborted) { dbg(`${source}: aborted -> skip`); return; }

    const targetCount = wf?.targets?.size ?? 0;
    const actorName = wf?.actor?.name;
    const itemName  = wf?.item?.name ?? wf?.activity?.name;
    dbg(`${source}: actor=${actorName} item=${itemName} targets=${targetCount}`);

    if (targetCount <= 1) return; // csak multi-targetnél törlünk

    const initiatorUserId = getInitiatorUserId(wf);
    if (!initiatorUserId) {
      // Ha továbbra sincs meg, töröljünk lokálisan (aki kapta a hookot)
      dbg(`${source}: no initiatorUserId -> clearing locally as fallback`);
      toast(`[Auto Untarget] Clearing targets (multi-target action).`);
      clearTargetsForUser(game.user, "(fallback-no-initiator)");
      return;
    }

    // Ha én vagyok az indító kliens, tisztítok magamnak
    if (game.user.id === initiatorUserId) {
      dbg(`${source}: I am the initiator -> clear locally`);
      toast(`[Auto Untarget] Clearing targets (multi-target action).`);
      clearTargetsForUser(game.user, "(initiator)");
      return;
    }

    // Ha GM vagyok és nem az indító, akkor szólok az indítónak
    if (game.user.isGM && game.socket) {
      dbg(`${source}: I am GM, emitting socket to initiator (${initiatorUserId})`);
      game.socket.emit(`module.${MOD_ID}`, { type: SOCKET_EVENT, userId: initiatorUserId });
      return;
    }

    // Más eset: nem indító és nem GM -> no-op
    dbg(`${source}: not initiator and not GM -> skip`);
  } catch (e) {
    console.error(`[${MOD_ID}] handleWorkflow error`, e);
  }
}
