---
name: Browser persistence fixtures
description: Prevent browser test setup from resetting stored data on every reload.
---

Seed private browser-test local storage once, or guard the seed so it only runs when the storage key is absent.

**Why:** An unconditional initialization script runs on reload too. It produced a false report of lost CoachAura data by replacing correctly saved records with the original empty test fixture. A guarded seed confirmed byte-for-byte storage preservation.

**How to apply:** Before diagnosing refresh data loss, inspect test initialization scripts and compare raw storage before and after reload. Never use an unconditional seed initialization script for a persistence test.

Use a complete validated saved-state fixture, or let the app produce one through
a real state-changing action; do not hand-build a partial persisted object.
An already-selected setting may intentionally be a no-op and produce no write.

**Why:** A legal-viewer browser test initially failed because a partial fixture
triggered recovery, then because selecting the current theme left storage empty.
Neither failure was evidence that the legal viewer corrupted saved data.

**How to apply:** Establish a valid committed baseline before comparing storage;
distinguish test setup failures from the feature under test.
