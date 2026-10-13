# CoachAura backup and persistence safety

The browser and APK keep separate workspaces. Existing records still use
`setstack-v1` and the original Zustand `{state, version: 0}` envelope. The Android
package is changing from `app.setstack.trainer` to `app.coachaura.trainer`; the
schema and storage key are unchanged, but Android gives the new package a separate
private app sandbox. The old app and its data are not deleted or automatically
copied. Export a backup from the old app and restore it in the new app to transfer
records.

## Saving

LocalStorage writes complete before changes become visible in the store.
When a write fails, the action is not applied; existing saved data stays intact.
The error screen keeps the underlying form mounted. Export a recovery copy,
free device space/check storage permission, choose **Check storage again**, then
repeat the failed action. The check does not automatically apply that action.

A failed initial read never substitutes demo clients. Retry loading, export the
original bytes for recovery, or choose a verified backup and review replacement.
Do not uninstall or clear app data as a recovery step.

## Portable backups

New backups use internal marker `app: "SetStack"` and schema `version: 2`.
Restore version 2 files with this updated CoachAura; older app builds may ignore
the newly included draft and preferences.
They include all clients, measurements, notes, sessions, assigned routines,
weekly plans, custom exercises, reusable templates, unfinished workout entries,
timer settings/deadlines, and display units. There is no encryption: keep copies
private. Saved load values are not rounded during export or restore.
Pending numeric fields retain their exact display strings and input units.
Temporarily out-of-range draft input is editable data, not a completed set;
logging still requires valid reps, weight and RIR.

Version 2 restoration replaces all these sections, including the current draft.
Version 1 and the original bare client-array format remain supported:

- Replace clients, measurements, workouts, routines, and weekly assignments.
- Clear the current unfinished workout: those formats did not back it up.
- Preserve current units.
- Replace custom exercises/templates when present, otherwise preserve them.
- Add empty `plan`/`rest` dictionaries to legacy routines missing those optional
  additions; do not guess missing exercises or repair invalid records.

Unsupported application/version markers, duplicate identities, invalid numbers
or dates, malformed nested records, broken assignments and unavailable routine
exercises reject the entire file. Nothing is silently filtered out.

Files above 20 MB are rejected before parsing to limit memory use. Large-data
tests cover 5,000 completed sessions, not maximum phone capacity or native
performance.

## Restore safety and recovery copy

Preview lists the incoming record counts, unfinished workout, units, and exactly
what replacement means. Confirmation validates again. Before committing, the
original saved envelope is copied to `setstack-v1.before-restore`. If either
checkpoint creation or the replacement write fails, active data is unchanged.

Only one pre-restore checkpoint is retained. A later restore replaces that
checkpoint. **Settings → Download pre-restore copy** exports it as a normal
version 2 backup when valid. Unreadable original bytes are exported unchanged
with an `original-recovery` filename; that is a diagnostic recovery file, not
a validated portable backup.

On Android, sharing prepares a cache file. Select a permanent destination and
verify the file exists there. Dismissing the share sheet is not a backup.

Device-local checkpoints do not protect against uninstalling, clearing app data
or device loss. Export a permanent backup first.

## Release verification still required

These storage regression tests do not establish Android update compatibility.
The renamed app uses `app.coachaura.trainer` and is a separate installation from
`app.setstack.trainer`; Android does not share their app-private data. Preserve
the old installation until its data has been exported and verified in a backup.
Same-package updates still require a compatible signing identity and WebView
storage origin, and must be tested on Android.
