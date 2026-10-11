import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baseline, verifyUpgradeMetadata, verifyBuiltApk } from "./verify-android-upgrade.mjs";

// TEST CLI fixtures, not claims of native/device test execution.
const badging = "package: name='app.setstack.trainer' versionCode='2' versionName='1.0.1'\nsdkVersion:'24'\ntargetSdkVersion:'36'\napplication-debuggable\napplication-label:'CoachAura'\n";
const certificates = `Signer #1 certificate SHA-256 digest: ${baseline.certificateSha256}\n`;
const freshDebugCertificate = `Signer #1 certificate SHA-256 digest: ${"ab".repeat(32)}\n`;
const capacitor = { appId: baseline.applicationId, appName: "CoachAura", server: { hostname: "localhost", androidScheme: "https" } };
test("TEST APK validation accepts higher-version CoachAura debug APK metadata", () => {
  assert.equal(verifyUpgradeMetadata(badging, certificates, capacitor).versionCode, 2);
});
test("TEST fresh Gradle debug signing is accepted without matching the installed certificate", () => {
  assert.equal(baseline.certificateSha256, "7393a705cab6cf2456acd07b2c16171597ae9b8e23cb0bf37cf94389fef294b9");
  const result = verifyUpgradeMetadata(badging, freshDebugCertificate, capacitor);
  assert.equal(result.certificateSha256, "ab".repeat(32));
});
test("TEST APK validation blocks invalid certificates and package, version, origin and SDK incompatibility", () => {
  assert.throws(() => verifyUpgradeMetadata(badging, "", capacitor), /exactly one valid SHA-256/);
  assert.throws(() => verifyUpgradeMetadata(badging, "Signer #1 certificate SHA-256 digest: 12\n", capacitor), /exactly one valid SHA-256/);
  assert.throws(() => verifyUpgradeMetadata(badging, certificates + certificates.replace("#1", "#2"), capacitor), /exactly one valid SHA-256/);
  assert.throws(() => verifyUpgradeMetadata(badging.replace("app.setstack.trainer", "app.coachaura.new"), certificates, capacitor), /Package ID/);
  for (const version of ["0", "1"]) assert.throws(() => verifyUpgradeMetadata(badging.replace("versionCode='2'", `versionCode='${version}'`), certificates, capacitor), /Version code/);
  assert.throws(() => verifyUpgradeMetadata(badging.replace("sdkVersion:'24'", "sdkVersion:'26'"), certificates, capacitor), /SDK/);
  assert.throws(() => verifyUpgradeMetadata(badging.replace("targetSdkVersion:'36'", "targetSdkVersion:'35'"), certificates, capacitor), /SDK/);
  assert.throws(() => verifyUpgradeMetadata(badging.replace("application-debuggable", ""), certificates, capacitor), /debug APK/);
  assert.throws(() => verifyUpgradeMetadata(badging.replace("application-label:'CoachAura'", "application-label:'SetStack'"), certificates, capacitor), /launcher name/);
  for (const server of [{ hostname: "other", androidScheme: "https" }, { hostname: "localhost", androidScheme: "http" }, { ...capacitor.server, url: "https://example.invalid" }]) {
    assert.throws(() => verifyUpgradeMetadata(badging, certificates, { ...capacitor, server }), /storage origin/);
  }
  assert.throws(() => verifyUpgradeMetadata("", certificates, capacitor), /Cannot read/);
});
test("TEST guard explicitly fails without native tools or an APK", () => {
  assert.throws(() => verifyBuiltApk("/TEST-missing.apk", undefined), /SDK unavailable/);
  assert.throws(() => verifyBuiltApk("/TEST-missing.apk", "/TEST-sdk"), /does not exist/);
});
test("TEST APK workflow needs no saved signing key and retains verification before artifact upload", () => {
  const workflow = readFileSync(new URL("../../../.github/workflows/setstack-android-debug.yml", import.meta.url), "utf8");
  assert.doesNotMatch(workflow, /actions\/cache@|fail-on-cache-miss|setstack-debug-keystore/);
  const build = workflow.indexOf("name: Build debug APK");
  const verify = workflow.indexOf("name: Verify signed APK metadata and CoachAura configuration");
  const upload = workflow.indexOf("name: Downloadable APK");
  assert.ok(build >= 0 && build < verify && verify < upload);
  assert.doesNotMatch(workflow.slice(0, upload), /COACHAURA_UPLOAD_(?:KEYSTORE|STORE|KEY_ALIAS|KEY_PASSWORD)/);
  assert.match(workflow, /working-directory: artifacts\/setstack\n\s*shell: bash\n\s*run: node scripts\/verify-android-upgrade\.mjs 2>&1 \| tee "\$RUNNER_TEMP\/setstack-apk-verification\.log"/);
  assert.match(workflow, /\$\{\{ runner\.temp \}\}\/setstack-apk-verification\.log/);
  assert.match(workflow, /name: CoachAura-debug-APK-\$\{\{ github\.run_number \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.match(workflow, /path: artifacts\/setstack\/android\/app\/build\/outputs\/apk\/debug\/app-debug\.apk/);
  assert.match(workflow, /if-no-files-found: error/);

  const gradle = readFileSync(new URL("../android/app/build.gradle", import.meta.url), "utf8");
  assert.match(gradle, /applicationId "app\.setstack\.trainer"/);
  assert.match(gradle, /versionCode 2/);
  assert.match(gradle, /versionName "1\.0\.1"/);
  assert.match(workflow, /build_release:[\s\S]*?default: false/);
  assert.match(workflow, /COACHAURA_UPLOAD_KEYSTORE_BASE64/);
  assert.match(workflow, /COACHAURA_UPLOAD_STORE_PASSWORD/);
  assert.match(workflow, /COACHAURA_UPLOAD_KEY_ALIAS/);
  assert.match(workflow, /COACHAURA_UPLOAD_KEY_PASSWORD/);
  const apkUpload = workflow.indexOf("name: Downloadable APK");
  const secretCheck = workflow.indexOf("name: Prepare optional Play upload signing");
  const missingSecretError = workflow.indexOf("name: Report missing release credentials");
  const bundle = workflow.indexOf("name: Build signed Play upload App Bundle");
  const bundleVerify = workflow.indexOf("name: Verify App Bundle signature");
  const bundleUpload = workflow.indexOf("name: Downloadable Play upload App Bundle");
  assert.ok(apkUpload >= 0 && apkUpload < secretCheck && secretCheck < missingSecretError &&
    missingSecretError < bundle && bundle < bundleVerify && bundleVerify < bundleUpload);
  assert.match(workflow, /jarsigner -verify/);
  assert.match(workflow, /name: CoachAura-upload-AAB-/);
  assert.match(workflow, /Remove temporary upload key/);

  assert.match(gradle, /COACHAURA_RELEASE_KEYSTORE_PATH/);
  assert.match(gradle, /COACHAURA_RELEASE_STORE_PASSWORD/);
  assert.match(gradle, /COACHAURA_RELEASE_KEY_ALIAS/);
  assert.match(gradle, /COACHAURA_RELEASE_KEY_PASSWORD/);
  assert.match(gradle, /if \(hasReleaseSigning\)[\s\S]*?signingConfig signingConfigs\.release/);
  assert.match(gradle, /Release signing is not configured/);
  assert.doesNotMatch(gradle, /storePassword\s*=\s*["'][^"']+["']/);
});
