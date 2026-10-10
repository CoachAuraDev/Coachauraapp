---
name: Workout logging safety
description: Preserve pending entries, canonical loads and independent template/client results.
---

Workout drafts must protect both logged sets and not-yet-logged input values
across client switches, navigation and app restarts. Copying previous performance
must fill new inputs only, never mutate the original workout.

**Why:** The user explicitly requires rapid gym logging without losing a session
or overwriting workout history.

**How to apply:** Keep the existing local storage identity and canonical kg
values. In particular, editing only reps or RIR must not round/reconvert an
unchanged historical load through display units. Assign reusable templates as
independent copies, preserving per-client actual results and existing analytics.

Rest countdowns can survive reloads, but foreground browser alerts must not be
advertised as guaranteed background Android notifications.

**Why:** The current app is a Capacitor web app; suspended web code cannot
reliably alert on a locked phone without a native notification implementation.

**How to apply:** Keep the alert limitation visible and distinguish tested
browser behaviour from physical Android sound/vibration validation.
