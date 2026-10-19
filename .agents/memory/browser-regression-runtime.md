---
name: Browser regression runtime
description: Keep CoachAura browser regressions serially safe, with test-specific snapshots and whole-suite timeouts.
---

The Chromium UI suite runs its workflows sequentially inside one test, so a timeout applies to the full sequence rather than only the newest regression. Shared chart snapshots are deep-compared by unrelated scenarios; optional details such as recovery hours should be included only in the tests that need them.

**Why:** Extending the sequence with saved-workout chart checks pushed the combined run just beyond the former limit, even though the new scenario itself passed. A shared snapshot field also changed comparisons in date-correction tests that did not intend to assert recovery.

**How to apply:** When adding browser scenarios, budget the test timeout for the full UI sequence and confirm the end-of-suite workflows complete. Scope additional snapshot fields to the scenarios that assert them.
