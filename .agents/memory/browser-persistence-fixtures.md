---
name: Browser persistence fixtures
description: Prevent browser test setup from resetting stored data on every reload.
---

Seed private browser-test local storage once, or guard the seed so it only runs when the storage key is absent.

**Why:** An unconditional initialization script runs on reload too. It produced a false report of lost CoachAura data by replacing correctly saved records with the original empty test fixture. A guarded seed confirmed byte-for-byte storage preservation.

**How to apply:** Before diagnosing refresh data loss, inspect test initialization scripts and compare raw storage before and after reload. Never use an unconditional seed initialization script for a persistence test.
