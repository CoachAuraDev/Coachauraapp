---
name: CoachAura local-first operation
description: User-stated requirement that core client and workout flows work offline.
---

CoachAura must remain local-first and functional offline. Individual Mode's workouts and preferences are a separate personal workspace, never a trainer-managed client. Switching modes must not merge, duplicate, or delete either dataset. Backups must include both workspaces and clearly describe when older backups preserve current personal data instead of replacing it.

**Why:** the user asked to keep Individual Mode separate from trainer clients and preserve all existing local records.

**How to apply:** keep normal client management and workout logging independent of mandatory network services; keep the personal workspace local and distinct; handle missing fields from older saves and backups without resetting the existing trainer workspace; treat optional services such as Google Play Billing separately from core offline behavior.
