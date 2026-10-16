---
name: GymMane analytics fidelity
description: The user's fidelity requirement for CoachAura client muscle analytics.
---

The earlier requirement was that client muscle analytics reproduce the actual GymMane anatomical visuals,
graph types and calculation definitions. Generic strength,
volume or workout-frequency charts are not substitutes. Do not guess what
upstream does or silently reinterpret its formulas.

**Why:** The user explicitly requested the original GymMane implementation,
not another muscle dashboard inspired by it.

**How to apply:** When working on retained upstream-derived implementations, inspect the relevant upstream implementation before revising
them. Explain compatibility limitations and renderer adaptations
honestly, retain required attribution, and preserve existing functionality
and client records. The user requires review before building another APK.

The user subsequently requested CoachAura's dark/lime palette for workload
colours while preserving intensity values, thresholds, filters and interactions.
Recovery must remain distinct from workload intensity.

**Why:** The user explicitly approved this presentation change, rather than a
change to GymMane's underlying calculations.

**How to apply:** Preserve the requested lime palette in the retained upstream-derived chart;
do not restore its original colours just to satisfy the earlier fidelity rule,
and do not use the workload palette to imply physiological recovery.

The user subsequently requested removal of the GymMane client muscle graph
and replacement with the existing CoachAura muscle dashboard. This supersedes
the earlier requirement to expose the exact upstream visualisations in profiles.

**Why:** The user explicitly requested the CoachAura view instead of the GymMane graph.

**How to apply:** Show only the existing CoachAura dashboard in client Muscle
Activity. Do not reintroduce the original/detailed view selector or upstream
graph there. Retain applicable GPL attribution and preserve stored workout data.

CoachAura's active dashboard also uses the requested six-colour dark/lime
workload presentation. Its five calculated categories must remain unchanged;
the two darkest trained colours blend within the existing low category.

**Why:** The user repeated the colour-only request after selecting the CoachAura
dashboard and expressly required unchanged calculations, filters and interactions.

**How to apply:** Preserve the active dashboard's lime workload presentation and
keep its recovery estimates separate. Do not restore the old blue/orange/red
workload colours when maintaining the CoachAura view.

Selected-period workload and longitudinal exposure history are separate views of the same
training log. Correcting a workout date can clear the selected-period totals while the last
exposure and recovery estimate still reflect that retained historical workout.

**Why:** The user explicitly requires recovery and last-exposure history to remain independent
of selected-period workload.

**How to apply:** When changing workout dates or activity-period filtering, verify selected-period
workload separately from recovery and last-exposure history; do not treat zero current-period
workload as deleted training history.
