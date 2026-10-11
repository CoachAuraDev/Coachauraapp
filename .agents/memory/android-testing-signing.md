---
name: Android testing signing
description: The owner's installed APK is a GitHub Actions debug build, not a release installation.
---

CI debug APKs may use the hosted runner's standard debug signing and must not
depend on a cached debug keystore. Their certificate can differ between runs;
validate that each artifact is actually signed and report that a different
certificate prevents in-place installation over an older APK.

**Why:** an Actions run built the APK successfully, but the cached debug key was
missing and a post-build guard failed only because the fresh debug certificate
did not match a historical phone installation. Requiring that old certificate
made debug artifact generation depend on unrecoverable cache state.

**How to apply:** keep debug signing separate from Play upload signing. Do not
reject a well-formed debug APK solely because its signer differs from a device
baseline; do warn that Android may require a backup and reinstall. A release
App Bundle must use the app's existing Play upload key supplied securely through
GitHub Secrets. Never generate or commit a replacement release key.
