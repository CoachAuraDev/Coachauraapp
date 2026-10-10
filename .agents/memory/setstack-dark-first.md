---
name: CoachAura dark-first design
description: The user's standing visual direction for the trainer app.
---

CoachAura should default to dark mode, including first launch, regardless of the Android device's system theme. Use near-black and charcoal surfaces, readable off-white/grey text and restrained electric-green accents for actions, selected tabs and progress. Avoid white startup and transition flashes.

**Why:** The user requested a consistent, polished dark-first design while preserving features and client data.

**How to apply:** Extend the existing shared theme when adding screens and dialogs. Check web startup and native Android backgrounds together; do not automatically switch the app to light mode based on device preferences.

Phone-layout checks should include realistic long client names and unbroken identifiers, not just the short demo roster.

**Why:** Short demo names hid grid min-content overflow during testing; long names also exposed overflowing confirmation messages.

**How to apply:** Check narrow dashboard and dialog layouts without masking page overflow.
