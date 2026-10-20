# CoachAura lifetime purchase setup

CoachAura uses Google Play Billing Library 9.1.0 and the one-time in-app product
`coachaura_lifetime`. The app reads the localized price from Google Play; the
Swedish base price is intended to be configured as 499 SEK in Play Console.

## Google Play Console

1. Create or select a CoachAura app in Play Console with application ID
   `app.coachaura.trainer`. If you already have a listing under
   `app.setstack.trainer`, Google Play does not allow changing that listing's
   application ID; the new ID requires a separate listing and cannot update the
   old listing's installations.
2. In **Monetize with Play > Products > In-app products**, create a product with
   ID `coachaura_lifetime`. Use a one-time product, not a subscription. Add the
   customer-facing title and description, set the initial SEK price to 499, and
   activate the product. Add other regional prices as appropriate.
3. In **Settings > License testing**, add the Google accounts that will test
   purchases. These accounts must also be enrolled in the relevant test track.
4. Upload a signed Android App Bundle to the new app's internal testing track.
   Use `app.coachaura.trainer` and increment the version code for later uploads
   to this listing.
   Finish the track release and add the testers.
5. For release-track testing, accept the tester invitation and install CoachAura
   from the Play Store test-track link. Google also permits a license tester to
   sideload a debug-signed build when its package ID matches the Play Console app
   and the Google account on the device is registered as a license tester. The
   Replit browser preview cannot exercise native Play Billing.
6. Open Settings in the test build. Confirm the product price appears,
   buy using the license tester account, then check that lifetime access appears.
   Cancel one test purchase and confirm access remains locked. Reinstall from
   Google Play or use **Restore / recheck purchase** to verify restoration.
7. Before public release, complete the applicable Play Console testing,
   app-content, privacy, data-safety, and release requirements.

Google may display test payment methods rather than charging the tester. Actual
checkout and Play ownership cannot be verified until the product and test track
are configured in Play Console.

## Building

The GitHub Actions **Build CoachAura debug APK** workflow always builds a
debug/testing APK using Gradle's standard debug signing. It does not require a
keystore cache or release credentials. Its signing certificate can differ from a
previous runner/device install; Android then requires an explicit backup and
reinstall rather than an in-place update. The workflow checks that the artifact
is validly signed and that the app ID, version, SDK and Capacitor origin are
correct, but it does not claim an in-place update was verified.

```sh
pnpm --filter @workspace/setstack run android:sync
cd artifacts/setstack
./android/gradlew -p android :app:assembleDebug
```

The debug APK is written to
`artifacts/setstack/android/app/build/outputs/apk/debug/app-debug.apk`.

To also create a **signed Play upload AAB**, run the workflow with its
`build_release` checkbox enabled and configure all of these GitHub repository
secrets:

- `COACHAURA_UPLOAD_KEYSTORE_BASE64` — base64-encoded JKS upload keystore.
- `COACHAURA_UPLOAD_STORE_PASSWORD` — keystore password.
- `COACHAURA_UPLOAD_KEY_ALIAS` — upload-key alias.
- `COACHAURA_UPLOAD_KEY_PASSWORD` — upload-key password.

When `build_release` is checked, also enter `highest_play_version_code` from the
highest version already used in Play Console. The workflow requires the configured
Gradle version code to be greater before it attempts release signing. Current
Gradle metadata is `app.coachaura.trainer`, version code `2`, version name `1.0.1`.
The workflow summary reports these configured values; the AAB still needs a
successful signed build before it exists.

### Create and back up the upload key

For an app that has **not** been enrolled/uploaded to Play before, create one
persistent upload keystore on a trusted computer (not in Actions), and keep the
passwords out of command history:

```sh
keytool -genkeypair -v -keystore coachaura-upload.jks \
  -alias coachaura-upload -keyalg RSA -keysize 2048 -validity 10000
```

Enter the keystore and key passwords only at the interactive prompts. Keep the
`.jks` file and both passwords in at least two encrypted, access-controlled
backup locations separate from the repository. Record the alias and certificate
fingerprint with the key backup. Do not email the keystore or put it in source
control. For an app already configured in Play Console, use its **existing**
upload key; never create a replacement just because a local/Actions copy is
missing.

In **Play Console → Setup → App integrity → Play App Signing**, enroll the app
and register the upload certificate as requested. Google Play App Signing keeps
the app-signing key that signs APKs delivered to users; the persistent upload key
only authenticates the AAB you submit. Preserve both roles and do not confuse the
upload certificate with the Play app-signing certificate. If an existing upload
key is lost, follow Play Console's key-reset process rather than silently
generating a different key.

Encode the keystore on the trusted computer as one line (Linux):
`base64 -w 0 coachaura-upload.jks`. Add that output and the three values as the
four GitHub repository secrets listed above; never paste them into chat or logs.
The workflow writes the decoded keystore only to the hosted runner's temporary
directory, verifies the AAB signature, and removes that temporary file. If the
release option is off, debug APK builds need neither these secrets nor a cached
debug keystore. If release is requested without all four secrets, the debug APK
is uploaded first and the job then fails with the missing secret names.

The AAB is an upload-signed artifact, not a Play release or a claim that Play
will accept the version. The current Gradle version is `versionCode 2` /
`versionName 1.0.1`; increment the version code for each new Play upload and
confirm it exceeds the highest code already used in Play Console. Gradle rejects
release tasks when signing credentials are missing.

## Entitlement and security limits

- The free plan may create three client profiles. The cap is enforced in the
  persistent client-creation action, not just in the Add Client button. Existing
  clients and workout data remain visible; editing and deleting remain available.
  Backup restore is not capped, so restoring an existing backup cannot discard
  clients.
- The native app queries Google Play at startup, when it returns to the
  foreground, after checkout, and from the Restore / recheck control. Only the
  `PURCHASED` state for `coachaura_lifetime` unlocks unlimited clients. Pending,
  cancelled, unavailable, and failed checks do not grant new access.
- Successful unconsumed purchases are acknowledged by the native Billing
  Library integration. If acknowledgement fails, the next purchase query retries.
- Entitlement is held in memory only; it is not written to the client-data
  storage key. A fresh Play query restores it after process restart or
  reinstallation. When Billing is unavailable, access fails closed for creating
  clients above the limit, but no existing client or workout record is removed.
- The development simulation is exposed only when Android marks the installed
  build as debuggable. It is session-only, never persisted, and cannot unlock a
  release build.
- This is client-only verification, not server-side receipt validation. A
  modified or rooted client may be tampered with. A future server verifier using
  the Google Play Developer API and a protected service account would provide
  stronger enforcement, but no account, backend, cloud sync, or paid service is
  part of this implementation.
- Client profiles, workouts, and the entitlement itself are not synchronized.
  Users must keep a CoachAura backup for local training data; restoring a backup
  does not change the Play-owned purchase.
