---
name: Unfinished workout safety
description: Protect an unfinished workout when adding trainer shortcuts across clients.
---

New trainer workout shortcuts must preserve an unfinished workout rather than silently replacing it when another client is selected.

**Why:** Trainers switch between clients, and the user explicitly requires preserving workout data. Dashboard quick starts therefore resume the current unfinished workout first.

**How to apply:** Check the live unfinished-workout state at action time, not only a captured render value. Resume it or obtain an explicit discard decision before creating a replacement.
