---
name: Browser regression runtime
description: Timeouts for CoachAura's Chromium UI regression suite must cover its complete serial workflow.
---

The Chromium UI suite runs its workflows sequentially inside one test, so a timeout applies to the full sequence rather than only the newest regression.

**Why:** Extending the sequence with saved-workout chart checks pushed the combined run just beyond the former limit, even though the new scenario itself passed.

**How to apply:** When adding browser scenarios, budget the test timeout for the full UI sequence and confirm the end-of-suite workflows complete.
