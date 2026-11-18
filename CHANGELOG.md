## 1.3.2

- Extend the declared D&D 5e compatibility range through 6.1.x and require Midi-QoL 14.7.0 or newer, the release line for D&D 5e 6.1.
- Confirm the existing `midi-qol.RollComplete` clearing lifecycle remains present in Midi-QoL 14.7.0; no JavaScript changes were needed.

## 1.3.1

- Updated completion handling for Midi-QoL 14.6.5: subscribe only to the emitted `midi-qol.RollComplete` hook. Removed subscriptions to `postCompleted` and `WorkflowComplete`, which are not emitted by this Midi-QoL build.
- Clear targets only when the current user's selected targets still match the completed workflow's targets. This avoids clearing a newer selection made for another action while this workflow was running.
- Retained the existing multi-target behavior: workflows with more than one target are cleared; single-target and aborted workflows are left untouched.
- Removed the unused initiator-ID and module-socket path. Midi-QoL invokes workflow hooks on the client executing that workflow, so the local user is the acting user.

## 1.3.0

- Initial multi-target workflow target-clearing implementation.
