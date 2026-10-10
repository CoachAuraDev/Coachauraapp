---
name: GymMane analytics fidelity
description: The user's fidelity requirement for CoachAura client muscle analytics.
---

Client muscle analytics must reproduce the actual GymMane anatomical visuals,
graph types and calculation definitions. Generic strength,
volume or workout-frequency charts are not substitutes. Do not guess what
upstream does or silently reinterpret its formulas.

**Why:** The user explicitly requested the original GymMane implementation,
not another muscle dashboard inspired by it.

**How to apply:** Inspect the relevant upstream implementation before revising
these analytics. Explain compatibility limitations and renderer adaptations
honestly, retain required attribution, and preserve existing functionality
and client records. The user requires review before building another APK.

The user subsequently requested CoachAura's dark/lime palette for workload
colours while preserving intensity values, thresholds, filters and interactions.
Recovery must remain distinct from workload intensity.

**Why:** The user explicitly approved this presentation change, rather than a
change to GymMane's underlying calculations.

**How to apply:** Keep the CoachAura lime workload palette as the default;
do not restore the original colours just to satisfy the earlier fidelity rule,
and do not use the workload palette to imply physiological recovery.
