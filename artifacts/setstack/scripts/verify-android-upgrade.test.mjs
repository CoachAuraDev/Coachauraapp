import test from "node:test";
import assert from "node:assert/strict";
import { baseline, verifyUpgradeMetadata, verifyBuiltApk } from "./verify-android-upgrade.mjs";

// TEST CLI fixtures, not claims of native/device test execution.
const badging = "package: name='app.setstack.trainer' versionCode='2' versionName='1.0.1'\nsdkVersion:'24'\ntargetSdkVersion:'36'\napplication-debuggable\napplication-label:'CoachAura'\n";
const certificates = `Signer #1 certificate SHA-256 digest: ${baseline.certificateSha256}\n`;
const capacitor = { appId: baseline.applicationId, appName: "CoachAura", server: { hostname: "localhost", androidScheme: "https" } };
test("TEST guard accepts higher-version same-identity same-origin test APK metadata", () => {
  assert.equal(verifyUpgradeMetadata(badging, certificates, capacitor).versionCode, 2);
});
test("TEST guard blocks signature, package, version, origin and SDK incompatibility", () => {
  assert.throws(() => verifyUpgradeMetadata(badging, certificates.replace(baseline.certificateSha256, "0".repeat(64)), capacitor), /Signing certificate/);
  assert.throws(() => verifyUpgradeMetadata(badging, certificates + certificates.replace("#1", "#2"), capacitor), /Signing certificate/);
  assert.throws(() => verifyUpgradeMetadata(badging.replace("app.setstack.trainer", "app.coachaura.new"), certificates, capacitor), /Package ID/);
  for (const version of ["0", "1"]) assert.throws(() => verifyUpgradeMetadata(badging.replace("versionCode='2'", `versionCode='${version}'`), certificates, capacitor), /Version code/);
  assert.throws(() => verifyUpgradeMetadata(badging.replace("sdkVersion:'24'", "sdkVersion:'26'"), certificates, capacitor), /SDK/);
  assert.throws(() => verifyUpgradeMetadata(badging.replace("targetSdkVersion:'36'", "targetSdkVersion:'35'"), certificates, capacitor), /SDK/);
  assert.throws(() => verifyUpgradeMetadata(badging.replace("application-debuggable", ""), certificates, capacitor), /debug APK/);
  assert.throws(() => verifyUpgradeMetadata(badging.replace("application-label:'CoachAura'", "application-label:'SetStack'"), certificates, capacitor), /launcher name/);
  for (const server of [{ hostname: "other", androidScheme: "https" }, { hostname: "localhost", androidScheme: "http" }, { ...capacitor.server, url: "https://example.invalid" }]) {
    assert.throws(() => verifyUpgradeMetadata(badging, certificates, { ...capacitor, server }), /storage origin/);
  }
  assert.throws(() => verifyUpgradeMetadata(badging, "", capacitor), /Signing certificate/);
  assert.throws(() => verifyUpgradeMetadata("", certificates, capacitor), /Cannot read/);
});
test("TEST guard explicitly fails without native tools or an APK", () => {
  assert.throws(() => verifyBuiltApk("/TEST-missing.apk", undefined), /SDK unavailable/);
  assert.throws(() => verifyBuiltApk("/TEST-missing.apk", "/TEST-sdk"), /does not exist/);
});
