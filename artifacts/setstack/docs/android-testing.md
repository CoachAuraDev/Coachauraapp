# SetStack on an Android phone (debug/test build)

SetStack is the existing React/TypeScript app wrapped by Capacitor 8, **not**
a new Flutter app. The Android application ID is `app.setstack.trainer`.
This is a stable testing identifier, not a verified claim to a unique
Play Store namespace; choose an ID you control before distributing a
release. Changing the ID later makes Android treat it as a different app
with separate local data.
The native project is `artifacts/setstack/android/`. Capacitor bundles
`artifacts/setstack/dist/public/` into the APK: no Replit development server
is needed when the APK opens. The optional Google web font needs a network
connection; a system font displays the interface offline. Minimum Android
version is 7 (API 24).
The generated launcher artwork is Capacitor's default placeholder; replace
it with final SetStack art before a public release.

## Easiest option from your Android phone: GitHub cloud build

These steps **build a future APK**. This Replit workspace has no Android
JDK/SDK and has not produced an APK yet.

1. In this Replit project, open **Tools → Git** (add the Git tool if needed).
   Choose **Connect to a Git provider → GitHub** and create or select a
   repository you control. A private repository is fine for testing. Stage
   the project files, commit and push. Check that the repository contains
   `.github/workflows/setstack-android-debug.yml`,
   `artifacts/setstack/android/gradlew` **and**
   `artifacts/setstack/android/gradle/wrapper/gradle-wrapper.jar`.
   Never commit client backup JSONs, `.env` files or signing keys.
2. On your phone, open that GitHub repository in a **web browser** (switch
   to Desktop site if buttons are hidden). Open **Actions**, choose
   **Build SetStack debug APK**, and tap **Run workflow** on the branch
   containing the changes. If GitHub asks you to enable Actions, do so
   for this repository.
3. Open the resulting run. Wait for a green check. Scroll to **Artifacts**
   and download **SetStack-debug-APK**. GitHub downloads a ZIP containing
   `app-debug.apk` (usually to your Downloads folder); extract the ZIP using
   Files on your phone.
4. In Files, tap `app-debug.apk`. If Android asks, allow **Install unknown
   apps** for the Files/browser app you used, then tap **Install**. Only
   install an APK you built yourself and trust. Open SetStack from the
   launcher. The debug APK is for personal testing, not paid distribution.

The workflow builds from source, runs unit checks and only uploads the APK
if Gradle produced a nonempty file. Downloaded workflow artifacts are
retained for seven days. To rebuild after web changes, push the changes
and run the workflow again. The workflow tries to reuse the debug signing
key; if it is lost or changed, Android will reject an update over the old
APK. **Export a JSON backup before uninstalling any APK**.

### If an Actions build fails

The workflow uses Ubuntu 24.04's preinstalled SDK and Node 24-compatible
actions. It does not use `android-actions/setup-android`. Failed SDK or
Gradle steps upload **SetStack-debug-build-logs** under the run's Artifacts;
download that ZIP to share the actual error. Deprecation warnings alone
do not identify a build failure.

After changing build files, commit and push them, then start a **new**
workflow run on the updated branch. **Re-run jobs** on an old run uses
the old source commit and will not pick up the fix.

### What to test on the phone

Use the clearly labelled starter/demo clients, or make a temporary client
named "TEST". Check that the home screen opens, navigation works, you can
create/edit/delete a test client, assign a program, start a workout, log
sets with reps/load/RIR, minimize and resume without losing sets, finish
the workout, see it in history and the muscle views, and view bodyweight.
Open Settings, choose **Save / share JSON**, and save the backup to a
lasting destination outside the app (for example Drive, if offered).
Confirm the file really appears there. Try importing a **test** backup
only after exporting your current data: restore replaces the client list.
Close and reopen the app to check persistence. No emulator/device test
has been run in this Replit container.

## Alternative: build on a computer with Android Studio

1. Install Node 22+ (Node 24 is used by the cloud workflow), pnpm 10.26.1
   and **Android Studio Otter 2025.2.1 or newer**. Install Android SDK
   **Platform 36** and Build Tools **36.0.0** with Android Studio's SDK
   Manager; set the Gradle JDK to **21**.
2. Download the **entire workspace source** or clone your GitHub repository,
   not just the `android/` folder. At the workspace root run:

   ```sh
   pnpm install --frozen-lockfile
   pnpm --filter @workspace/setstack run android:debug
   ```

   That command builds the React production bundle, syncs Capacitor and
   calls Gradle `assembleDebug`. If the SDK is not found, set `ANDROID_HOME`
   to the Android SDK directory or open `artifacts/setstack/android/`
   in Android Studio to let it create `local.properties`.
3. A **successful** local build creates
   `artifacts/setstack/android/app/build/outputs/apk/debug/app-debug.apk`.
   Transfer that file to your phone (USB, Drive, etc.), then follow
   step 4 above. Alternatively, open `artifacts/setstack/android/` as a
   project in Android Studio and choose **Build → Build Bundle(s) / APK(s)
   → Build APK(s)**. You can also connect your phone by USB and press
   **Run** in Android Studio.

The checked-in native project includes the Gradle wrapper, Java activity,
application manifest, Android resources, Capacitor plugins and package
configuration. `android/app/src/main/assets/public/` is regenerated by
`android:sync` and deliberately not committed. Do **not** enable
`server.url` in `capacitor.config.ts`: that would make the APK depend
on a web server rather than its own bundled app.

## Data, backup and signing safety

- SetStack uses the existing Zustand state and stores clients, programs,
  completed workout history, custom exercises, unit setting and any
  unfinished workout in the app WebView's **`setstack-v1` localStorage**.
  It is device-local; there is no account or cloud sync. Android system
  backup/device transfer is disabled for client privacy. Uninstalling,
  clearing app data or losing the device can erase it.
- The browser preview and the Android APK have **separate** storage. In the
  browser, open **Settings → Download JSON** and move the file onto the
  phone. In the APK, open **Settings → Choose JSON** to import it. Import
  replaces the APK's current clients: export the current APK data first.
  On Android, **Save / share JSON** prepares a temporary JSON file and
  opens the share sheet; choose a destination and **check it was saved**.
  Simply dismissing the share sheet is not a backup. This backup contains
  clients, routines, sessions and custom exercises, but does **not**
  include the unfinished workout draft or the unit preference.
- Keep the same application ID and the same signing certificate for
  updates, and increase `versionCode` in `android/app/build.gradle` for
  each release. A signed release APK uses a different certificate from
  this debug build and cannot install *over* the debug APK. Export first,
  then remove the debug build and install the release build.
- For a signed release, open the project in Android Studio, select
  **Build → Generate Signed Bundle / APK → APK**, create your own
  keystore, select **release**, then finish the wizard. Android Studio
  displays the output location after building (often `android/app/release/`;
  it depends on your chosen destination). Back up your keystore securely
  **outside this repository**. Do not share its passwords in chat or
  upload it here. Test the exact signed APK on real devices before
  offering it for sale.
- SetStack contains GymMane-derived GPL-3.0 code. A paid APK still needs
  attribution and the GPL licence, and buyers must receive access to the
  complete corresponding source under GPL terms. The bundled
  `legal/` directory has the licence/notice and Capacitor MIT notices;
  the source tree includes original GymMane notices. A commercial
  release needs a separate privacy/security, licences, app branding,
  purchase/distribution and real-device QA review. This debug workflow
  does not implement a payment or lifetime entitlement.
