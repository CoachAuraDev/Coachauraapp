# Uploaded testing APK and update safety

The uploaded APK's compiled manifest identifies:

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

## Prepared protections, not a verified device upgrade

The source now uses version code `2` and version name `1.0.1`, retaining the same
package and storage origin. The GitHub debug build now verifies the produced
APK with Android's `apksigner`, then checks its certificate against this baseline,
its package/version/SDK metadata with `aapt`, and its embedded Capacitor origin
and CoachAura branding. A mismatch stops the build **before APK upload**.

The existing workflow caches the debug keystore. This only helps if that cached
key is the original one and remains available. The certificate check will
detect a different/recreated key. A cached key's compatibility has not been
verified in this workspace. Never overwrite or rotate it to silence the guard.
An APK does not contain its private signing key.

The metadata regression tests use clearly marked CLI fixtures. They are not
native instrumented tests, Android launch tests or full APK-signature tests.
No new APK was generated as part of this preparation.

## Steps before testing an update on your phone

1. Export your existing app's client data to a permanent file and confirm it
   exists. Keep the original APK too.
2. After reviewing these changes, push them to your GitHub repository.
3. Run **Actions → Build CoachAura debug APK → Run workflow**.
4. If the compatibility check fails, keep your current installation. Do not
   uninstall or clear its data. Recover the original cached test key or plan
   a deliberate backup-and-restore migration first.
5. Only after the check passes, download the resulting APK and choose **Update**
   on Android. If Android refuses an update, stop; do not uninstall as a workaround.
6. Verify existing clients, measurements, workout history and unfinished work,
   then close/reopen the app. These on-device checks have not been performed here.

Your old APK has an older backup implementation. It may omit the live workout
or preferences, so finish/save any valuable pending work before a migration.

## Commercial release remains blocked

A debug APK is not a commercial release candidate. Release signing is not
configured, and the original release block produces an unsigned release.
Do not reuse the debug key for commercial distribution or store a production
key in Actions caches/source control.

A newly signed release generally cannot update this debug installation directly
because its signing identity differs. Preserve the testing installation and its
data until an explicit migration has been planned. Production-key provisioning,
signed-release builds, native regression tests and actual device upgrades remain
unverified. The workspace currently has no JDK/Android SDK/device tools; the
included cloud workflow provides those tools for the debug compatibility check.
