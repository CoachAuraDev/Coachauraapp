---
name: Android testing signing
description: The owner's installed APK is a GitHub Actions debug build, not a release installation.
---

The owner confirmed their installed Android app is a GitHub Actions debug APK.
Do not assume a commercial release key can update it in place.

**Why:** preserving the package and storage identifiers is insufficient if the
signing identity differs. The APK's public certificate cannot recover the
private key, and recreating a debug keystore gives a different identity.

**How to apply:** verify a testing update against the installed certificate and
existing cloud-cache key before offering it. Preserve the current installation
and backups when planning production signing; never recommend uninstalling as
an update-error workaround. Do not use the cached debug key commercially.

Caching a debug key after earlier builds does not restore their signing identity.

**Why:** comparison of two owner-supplied APKs found identical bundled web files
but different signing certificates. A new build can still contain old code and
simultaneously be incompatible with the original installation.

**How to apply:** inspect actual APK contents and the workflow's checked-out
revision, not download names or successful job status. Do not replace the
installed-certificate baseline with a newer artifact's certificate just to make
the guard pass. Confirm which installation remains on the phone before planning
an update or an explicitly approved backup-based migration.
