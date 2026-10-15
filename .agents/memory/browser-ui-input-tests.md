---
name: Browser UI input tests
description: Controlled input behavior in CoachAura's dependency-free Chromium UI tests.
---

In the Node/Chromium UI harness, synthetic DOM events and CDP keyboard selection were unreliable for controlled numeric inputs. The harness sets the rendered field value and invokes its React `onChange` callback; blur behavior is then invoked separately.

**Why:** The workspace has Chromium but no browser automation library, and controlled input values must be reflected in Zustand state to test real draft persistence and numeric validation.

**How to apply:** Reuse the existing UI harness for profile/workout input regressions. If React or the harness changes, verify the direct React-props callback access still works; do not add a browser dependency just for these flows without a clear need.
