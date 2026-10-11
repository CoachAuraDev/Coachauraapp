import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { baseline, verifyUpgradeMetadata, verifyBuiltApk } from "./verify-android-upgrade.mjs";

// TEST CLI fixtures, not claims of native/device test execution.
const badging = "package: name='app.setstack.trainer' versionCode='2' versionName='1.0.1'\nsdkVersion:'24'\ntargetSdkVersion:'36'\napplication-debuggable\napplication-label:'CoachAura'\n";
const certificates = `Signer #1 certificate SHA-256 digest: ${baseline.certificateSha256}\n`;
const capacitor = { appId: baseline.applicationId, appName: "CoachAura", server: { hostname: "localhost", androidScheme: "https" } };
test("TEST guard accepts higher-version same-identity same-origin test APK metadata", () => {
  assert.equal(verifyUpgradeMetadata(badging, certificates, capacitor).versionCode, 2);
});
test("TEST confirmed reinstall baseline accepts its certificate and rejects the superseded installation", () => {
  assert.equal(baseline.certificateSha256, "7393a705cab6cf2456acd07b2c16171597ae9b8e23cb0bf37cf94389fef294b9");
  const superseded = "Signer #1 certificate SHA-256 digest: dfd0a0abb60da9a886dfdfeeb10b076240de58f1fcf5ea7a4406d11da796f8cd\n";
  assert.throws(() => verifyUpgradeMetadata(badging, superseded, capacitor), /Signing certificate/);
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
test("TEST workflow stops on a missing signing cache and retains verification before APK upload", () => {
  const workflow = readFileSync(new URL("../../../.github/workflows/setstack-android-debug.yml", import.meta.url), "utf8");
  assert.match(workflow, /path: ~\/\.android\/debug\.keystore\s*\n\s*key: [^\n]+\n\s*fail-on-cache-miss: true/);
  const cache = workflow.indexOf("name: Reuse the test signing key");
  const build = workflow.indexOf("name: Build debug APK");
  const verify = workflow.indexOf("name: Verify signature and compatibility");
  const upload = workflow.indexOf("name: Downloadable APK");
  assert.ok(cache >= 0 && cache < build && build < verify && verify < upload);
  assert.match(workflow, /working-directory: artifacts\/setstack\n\s*shell: bash\n\s*run: node scripts\/verify-android-upgrade\.mjs 2>&1 \| tee "\$RUNNER_TEMP\/setstack-upgrade-verification\.log"/);
  assert.match(workflow, /\$\{\{ runner\.temp \}\}\/setstack-upgrade-verification\.log/);
});
