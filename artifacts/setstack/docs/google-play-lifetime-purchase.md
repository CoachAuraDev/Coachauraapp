# CoachAura lifetime purchase setup

CoachAura uses Google Play Billing Library 9.1.0 and the one-time in-app product
`coachaura_lifetime`. The app reads the localized price from Google Play; it does
not hardcode the advertised 299 SEK price.

## Google Play Console

1. Open the existing CoachAura app in Play Console. Confirm its application ID is
   `app.setstack.trainer`.
2. In **Monetize with Play > Products > In-app products**, create a product with
   ID `coachaura_lifetime`. Use a one-time product, not a subscription. Add the
   customer-facing title and description, set the initial SEK price to 299, and
   activate the product. Add other regional prices as appropriate.
3. In **Settings > License testing**, add the Google accounts that will test
   purchases. These accounts must also be enrolled in the relevant test track.
4. Upload a new signed Android App Bundle to an internal testing track. Keep the
   existing application ID and increment the app version code for the upload.
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

From the repository root:

```sh
pnpm --filter @workspace/setstack run android:sync
cd artifacts/setstack
./android/gradlew -p android :app:assembleDebug
```

The debug APK is written to
`artifacts/setstack/android/app/build/outputs/apk/debug/app-debug.apk`.
For a Play upload, build an App Bundle with
`./android/gradlew -p android :app:bundleRelease`; the release build must be
signed with the app's legitimate release signing configuration. Do not commit a
private signing key. The existing debug signing configuration is not a
production Play signing setup.

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
