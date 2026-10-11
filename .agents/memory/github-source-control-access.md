---
name: GitHub source-control access
description: Source-provider authorization did not provide working CLI access or generic integration forms.
---

A GitHub source-control connection is not interchangeable with a normal
connector integration when opening connection forms.

**Why:** binding reported success and OAuth status was healthy, but the GitHub
CLI had no authenticated session and Git remote access timed out. The generic
reconnect form rejected it as unconnected; the normal form then required a
connector ID. Repeating those forms did not establish access.

**How to apply:** do not assume a healthy/bound source-provider row proves CLI
access. Verify a harmless repository read first. Use documented source-control
authentication or a manual Git-pane handoff when blocked; do not request tokens
in chat or guess undocumented connector-fetch arguments.
