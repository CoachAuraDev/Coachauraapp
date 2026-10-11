---
name: Development error-overlay transport
description: Expected persistence failures can obscure recovery controls in preview.
---

The runtime-error overlay's browser-to-server message includes error message and
stack, but not the custom error name. A server filter based only on
`PersistenceFailure` as the error name does not suppress it.

**Why:** private-browser quota tests showed that this overlay blocks ordinary
clicks on the otherwise functioning recovery UI, even with a name-based filter.
Window listener interception also did not resolve those tests.

**How to apply:** scope any future filtering to a stable, transported marker for
explicitly handled persistence failures; preserve overlays for unexpected errors.
Verify the actual plugin transport and recovery clicks rather than assuming
server-side errors retain their original class identity.
