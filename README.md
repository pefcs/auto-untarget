# Auto Untarget after Multi-Target Actions

Automatically clears the acting player's selected targets after a completed Midi-QoL workflow that used more than one target. Ordinary single-target actions are left untouched.

## Behavior

- Listens to Midi-QoL's `midi-qol.RollComplete` hook.
- Clears the current user's target selection when the completed workflow used more than one target and the current selection still matches that workflow's targets.
- Leaves a different current target selection alone. This protects targets selected for another action while the workflow was running.
- Clears targets locally for the user whose client executed the workflow; it does not broadcast a target clear to other players.
- Skips aborted workflows.

The selection comparison is important for Midi-QoL 14.6.5. Midi-QoL now restores the pre-workflow target selection during its `postCleanup` handling only when the current selection still matches the completed workflow's targets. Auto Untarget clears at `RollComplete`, before that restoration, so the intentional clear is preserved. If the selection has changed in the meantime, Auto Untarget does not erase it.

## Requirements

- Foundry VTT 14.369 or newer within the V14 series
- D&D 5e 6.0.6–6.0.999
- Midi-QoL (tested against 14.6.5)

## Settings

The **Debug logging** world setting enables console diagnostics and the informational notification shown when targets are cleared. It is enabled by default.

## Development

The GitHub Actions workflow validates the module manifest and JavaScript, creates a Foundry-compatible ZIP, and publishes a GitHub Release when the manifest version changes.
