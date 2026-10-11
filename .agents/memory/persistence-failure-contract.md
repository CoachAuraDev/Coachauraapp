---
name: Persistence failure contract
description: Why CoachAura must publish only durable changes and keep failed hydration recoverable.
---

Trainer-facing saved state must not change until its storage write succeeds.
Unreadable saved data must remain recoverable, not be replaced by demo defaults.

**Why:** handlers close forms or finish sessions after a store action. Publishing
before persistence can make failed saves look successful, lose inputs on restart,
and create duplicate records when a trainer retries.

**How to apply:** preserve this ordering when changing storage or middleware.
Keep failure-path regression tests, legacy backup compatibility, and explicit
recovery UI. Editable pending text is distinct from validated training values;
do not turn invalid unfinished input into a completed set or silently drop it.
