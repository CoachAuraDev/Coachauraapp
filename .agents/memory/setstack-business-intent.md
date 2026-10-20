---
name: CoachAura commercial intent
description: The user's stated commercial positioning for the Android product.
---

The user intends CoachAura to offer up to three client profiles free, with unlimited clients unlocked by a one-time Google Play purchase of `coachaura_lifetime`, with a Swedish base price of 499 SEK. There are no subscriptions or mandatory accounts.

**Why:** This is the user's current stated product and pricing model; the actual Play Console base and regional prices remain unverified.

**How to apply:** Display the localized price returned by Google Play, preserve local data when the cap is reached, and distinguish client-side purchase checks from server-side verification.

The rename is a display-branding change, not a new installation or data migration.

**Why:** The user explicitly requested CoachAura branding while preserving existing saved data and the Android application ID.

**How to apply:** Retain legacy application/package identifiers, persistence keys and backup-format identifiers when rebranding; require the same signing key for an Android update.
