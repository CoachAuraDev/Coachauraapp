---
name: CoachAura dark-first design
description: The user's standing visual direction for the trainer app.
---

CoachAura has two fixed dark themes: Original Lime Green is the default, with #B7F34A accents; Peach Theme retains the existing soft peach #E8A87C accents. Both use near-black and charcoal surfaces with readable off-white/grey text. Do not follow the Android system theme or show white startup flashes.

**Why:** The user requested Original Lime Green as the default and the existing orange/peach palette renamed Peach Theme, while preserving explicitly saved selections.

**How to apply:** Keep the selector limited to these palettes and bind screens, dialogs, charts and status highlights to the selected theme. Preserve a valid saved choice and do not automatically switch to light mode based on device preferences.

Phone-layout checks should include realistic long client names and unbroken identifiers, not just the short demo roster.

**Why:** Short demo names hid grid min-content overflow during testing; long names also exposed overflowing confirmation messages.

**How to apply:** Check narrow dashboard and dialog layouts without masking page overflow.
