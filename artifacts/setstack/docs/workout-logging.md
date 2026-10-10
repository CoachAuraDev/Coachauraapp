# Fast workout logging

## Start and log
1. Open an athlete and start a session, or start a specific routine.
2. The logger shows that athlete's most recent working sets for each exercise.
   Tap **Copy set** or an individual previous set to fill the inputs; this does
   not modify the earlier workout or log a new set until you tap **Log**.
3. Assigned rep/load targets take priority. Otherwise, defaults use the
   corresponding previous working set, then a current-session set. With no
   history, the starting inputs are 8 reps and 0 kg; choose an appropriate load.
4. Edit load, reps and optional RIR, then tap **Log work set**. Use **Warm-up**
   for warm-up sets. Load inputs accept fractional weights.
5. Switch exercises using the exercise buttons or **Next**; use **+** to search
   or choose a recently trained exercise. Logged sets have an inline edit control.
6. Tap **Finish workout** to save completed results.

## Reusable templates
1. In a client profile, select **New routine**.
2. Choose exercises in the desired order, set counts, per-set rep targets and
   rest seconds. **Apply … to all** fills that exercise's rep targets.
3. **Save routine** saves to this client. **Save as template** separately saves
   a reusable library copy without closing the editor.
4. For any client, select the saved template under **Your templates** and assign
   it. Assignments are independent routine copies, not shared workout results.
5. To revise a reusable template, edit a routine and save a new template.
   Removing a library template does not remove routines already assigned.

## Rest timer
- Logging a set automatically starts the assigned rest period (or the client
  default). Timer settings can override this for the current workout.
- Start, pause/resume, reset, add 15 seconds or dismiss the timer without leaving
  the logging screen.
- Optional sound and vibration depend on browser/device support and require the
  workout logger to remain open and the device awake. Countdown deadlines survive
  minimising and reloads, but alerts are not reliable with the logger minimised,
  the app suspended/closed or the screen locked. No Android background notification
  service was added.

## Draft safety and history edits
- Logged draft sets and pending weight/reps/RIR inputs save automatically to the
  existing `setstack-v1` local storage key. Weights remain in kilograms internally.
- Minimising or navigating keeps the draft. Reopening or reloading resumes it.
  Starting another workout resumes the existing draft rather than replacing it.
- Explicitly discarding a workout still requires confirmation.
- In **Workout history**, select **Edit workout**. Change name/date or set values,
  add/remove sets, then save. Cancel leaves the original untouched. Existing
  history-based records and analytics read the updated results automatically.
- Client/template data is included in JSON backups; an unfinished draft is
  preserved locally, but is not included in the existing portable backup format.
  Browser and APK storage are separate; neither syncs to a cloud service.
- Unsaved changes inside routine/history editor dialogs require **Save** and are
  not draft-autosaved. Installed Android keyboard, vibration and lock-screen
  behaviour still need on-device testing after a reviewed APK build.
