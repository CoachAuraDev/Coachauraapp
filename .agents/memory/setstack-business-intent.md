---
name: CoachAura commercial intent
description: The user's stated commercial positioning for the Android product.
---

The user intends CoachAura (formerly SetStack) to be a downloadable Android APK sold to personal trainers for a one-off lifetime payment of 399 SEK.

**Why:** This is the user's stated product and pricing goal, not a feature implemented by the code.

**How to apply:** Keep Android installation, safe updates, data portability, and GPL source obligations in mind for release work. Do not assume that payment or entitlement has been implemented.

The rename is a display-branding change, not a new installation or data migration.

**Why:** The user explicitly requested CoachAura branding while preserving existing saved data and the Android application ID.

**How to apply:** Retain legacy application/package identifiers, persistence keys and backup-format identifiers when rebranding; require the same signing key for an Android update.
