---
name: Browser UI input tests
description: Controlled input behavior in CoachAura's dependency-free Chromium UI tests.
---

In the Node/Chromium UI harness, synthetic DOM events and CDP keyboard selection were unreliable for controlled numeric inputs. The harness sets the rendered field value and invokes its React `onChange` callback; blur behavior is then invoked separately.

**Why:** The workspace has Chromium but no browser automation library, and controlled input values must be reflected in Zustand state to test real draft persistence and numeric validation.

**How to apply:** Reuse the existing UI harness for profile/workout input regressions. If React or the harness changes, verify the direct React-props callback access still works; do not add a browser dependency just for these flows without a clear need.

Browser navigation checks must establish that the new document has loaded before
querying its UI, and browser commands need bounded response waits.

**Why:** Repeated cross-client and date-period navigation exposed intermittent
lost evaluation responses while the previous document was unloading. Existing
selectors can also briefly match that old document, giving false readiness.

**How to apply:** Treat document loading and React content readiness as separate
conditions in browser regressions; do not rely on a matching selector alone after
navigation or reload.
