# Uploaded testing APK and update safety

## Original testing APK (superseded installation)

The first uploaded APK's compiled manifest identifies:

- Package: `app.setstack.trainer`
- Version code/name: `1` / `1.0`
- Minimum/target Android SDK: `24` / `36`
- Debuggable: true; Android automatic backups: disabled
- Embedded Capacitor name: SetStack; older light startup configuration
- WebView origin: `https://localhost`
- Bundled web code still uses storage key `setstack-v1`

The ZIP CRC check passed. The v2 signing block contains an Android Debug
certificate with SHA-256:

`dfd0a0abb60da9a886dfdfeeb10b076240de58f1fcf5ea7a4406d11da796f8cd`

This is public certificate metadata, **not a private signing key**. Parsing that
certificate is not a full cryptographic APK-signature verification. The uploaded
APK SHA-256 is:

`fb59f02e49a4f30f4366f24c52009e05128359880312d7c8a94aec60577e9f76`

## Confirmed reinstall and stale build source — 2026-10-11

The owner confirmed uninstalling/reinstalling using the later uploaded APK.
Its package, version and SDK metadata remain the same, but its v2 certificate
SHA-256 is:

`7393a705cab6cf2456acd07b2c16171597ae9b8e23cb0bf37cf94389fef294b9`

Its APK SHA-256 is:

`756e3bf63ab7ec86466ff15e9697360e099bf629a4d4cff130d92210b5386d0f`

All 18 embedded web files match the first APK byte-for-byte. The supplied run
screenshot shows a **re-run** at commit `2d19783`. Inspection of that historical
commit confirms SetStack branding, version `1` / `1.0`, and the old light theme.
A changed run heading does not change the checked-out commit.

The audit baseline records the APK the owner confirmed installing, not the
removed original installation. That certificate remains useful as historical
evidence. The debug build no longer requires it, since this build is for a fresh
installation rather than a data-preserving update.

Uninstalling normally removes private app storage. Do not claim that original
client records survived this reinstall. Preserve any prior exports for validated
restoration; do not uninstall again to work around an update failure.

## Android debug build configuration

### Previous guarded-build failure — 2026-10-11

The supplied current-run logs show 67 application, four SDK-setup and four
upgrade-metadata tests passing. The web build and Capacitor sync succeeded.
Gradle reported `BUILD SUCCESSFUL in 2m 41s`; the subsequent nonempty-APK check
passed. An APK existed on that cloud runner, but it was not uploaded by the
earlier compatibility gate.

That run reported **Cache not found**. The old workflow then either stopped
before Gradle (the fail-closed revision) or rejected the APK at the installed
certificate comparison (the earlier revision). This was a signing-policy
failure, not the Gradle compilation failure. The runner APK was not uploaded
and is not present in this workspace.

### Current fresh-install build policy

The Android app Gradle file does not configure a custom debug signing
certificate. Gradle's standard `debug` build type automatically uses and
generates its normal debug keystore on the GitHub runner. The build workflow now
omits the required-cache step, so no saved original key or committed private key
is needed.

The source retains application ID `app.setstack.trainer`, version code `2`,
version name `1.0.1` and the existing web app data/configuration. The build
verifies that the APK signature is valid, that it has one SHA-256 signer, and
that its package/version/SDK metadata, CoachAura label and bundled Capacitor
origin match the app. It does not compare the new certificate to the phone's
certificate. The APK is uploaded only after these checks pass.

The build was not rerun after this workflow change, so no APK has yet been
produced or downloaded from the updated workflow. The earlier cloud Gradle
success applies to compilation; the updated run still needs to verify the new
signing and artifact-upload path.

### Read-only recovery investigation

The repository includes a manual **Inspect CoachAura signing-key recovery**
workflow. After pushing the reviewed changes, run it on `main` and leave its
previous-build run ID at `38084521824`. It requests only GitHub `Actions: read`
and `contents: read` permissions. It reports whether GitHub still lists the exact
expected cache entry and checks the named successful APK run's cache restore/save
messages. It does not build an APK, restore or upload a keystore, modify a cache,
or access client data.

A listed cache entry is only metadata; the signing certificate still has to be
verified before relying on any key. If the cache is absent, or the retained logs
do not establish that it was saved, that does not rule out a separate secure
copy. If GitHub no longer retains the previous logs, the result must remain
inconclusive. Do not create or substitute a key to make this diagnostic pass.

The metadata regression tests use clearly marked CLI fixtures. They are not
native instrumented tests, Android launch tests or full APK-signature tests.
No APK was generated as part of the earlier signing-key investigation.

The read-only signing-recovery workflow itself also has regression tests for
cache inventory validation, historical-run selection, and safe log summaries.
These are code/fixture tests; GitHub API access and previous-run inspection only
become verified when the owner runs the workflow and reviews its report.

## Build and download a debug APK

1. Push the updated `main` branch to GitHub. This workspace may contain commits
   not yet pushed; verify they are included.
2. Open **Actions → Build CoachAura debug APK → Run workflow** and select
   **main**. Start a new run rather than rerunning an older commit.
3. Confirm the source commit in the **CoachAura Android build source** summary.
   When the run succeeds, open its artifacts and download
   `CoachAura-debug-APK-<run number>-<attempt>`.
4. The APK keeps application ID `app.setstack.trainer`, so Android will reject
   installing it over an existing copy signed by a different key. Building the
   APK does not uninstall anything. Replacing that installation requires
   uninstalling it first, which erases its app-private data; that step is not
   performed by this workflow.
5. Installing it on a clean device is a fresh install. The APK has not yet been
   installed or launched on a device.

Your old APK has an older backup implementation. It may omit the live workout
or preferences, so finish/save any valuable pending work before a migration.

## Commercial release remains blocked

A debug APK is not a commercial release candidate. Release signing is not
configured, and the original release block produces an unsigned release.
Do not reuse the debug key for commercial distribution or store a production
key in Actions caches/source control.

A commercially signed release cannot be built from this debug configuration.
Release-key provisioning, signed-release builds, native regression tests and
device installation remain unverified. The workspace currently has no
JDK/Android SDK/device tools; the GitHub workflow provides those tools for debug
builds.
