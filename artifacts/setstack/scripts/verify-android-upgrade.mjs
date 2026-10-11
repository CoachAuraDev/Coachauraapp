import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

export const baseline = JSON.parse(readFileSync(new URL("./android-upgrade-baseline.json", import.meta.url), "utf8"));

export function verifyUpgradeMetadata(badging, certificates, capacitor, expected = baseline) {
  const packageInfo = badging.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m);
  if (!packageInfo) throw new Error("Cannot read APK package/version metadata.");
  if (packageInfo[1] !== expected.applicationId) throw new Error("Package ID differs: this is not an in-place update.");
  const versionCode = Number(packageInfo[2]);
  if (!Number.isSafeInteger(versionCode) || versionCode <= expected.versionCode) throw new Error("Version code must exceed the installed build.");
  const minSdk = Number(badging.match(/^sdkVersion:'(\d+)'/m)?.[1]);
  const targetSdk = Number(badging.match(/^targetSdkVersion:'(\d+)'/m)?.[1]);
  if (minSdk !== expected.minSdkVersion || targetSdk < expected.targetSdkVersion) throw new Error("SDK compatibility changed; review before updating.");
  if (!/^application-debuggable\s*$/m.test(badging)) throw new Error("This testing upgrade guard expects a debug APK, not a release candidate.");
  if (!/^application-label:'CoachAura'\s*$/m.test(badging)) throw new Error("Installed launcher name must be CoachAura.");
  const digests = [...certificates.matchAll(/^Signer #\d+ certificate SHA-256 digest:\s*([a-fA-F0-9:]+)\s*$/gm)]
    .map((m) => m[1].replaceAll(":", "").toLowerCase());
  if (digests.length !== 1 || !/^[a-f0-9]{64}$/.test(digests[0])) {
    throw new Error("APK must have exactly one valid SHA-256 signing certificate.");
  }
  if (capacitor.appId !== expected.applicationId || capacitor.appName !== "CoachAura" ||
      capacitor.server?.hostname !== expected.hostname || capacitor.server?.androidScheme !== expected.androidScheme ||
      capacitor.server?.url) {
    throw new Error("Bundled Capacitor branding/storage origin is incompatible or uses an external server.");
  }
  return { applicationId: packageInfo[1], versionCode, versionName: packageInfo[3], certificateSha256: digests[0] };
}

function command(tool, args) {
  const result = spawnSync(tool, args, { encoding: "utf8", maxBuffer: 4 * 1024 * 1024 });
  if (result.error) throw new Error(`Cannot run ${tool}: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${tool} failed verification: ${result.stderr.trim()}`);
  return result.stdout;
}

export function verifyBuiltApk(apk, sdk) {
  if (!sdk) throw new Error("Android SDK unavailable; run this guard in the configured GitHub Actions build.");
  if (!existsSync(apk)) throw new Error("Candidate APK does not exist. No upgrade was verified.");
  const tools = join(sdk, "build-tools", "36.0.0");
  // apksigner verifies the actual APK signature, not merely the embedded cert.
  const certificates = command(join(tools, "apksigner"), ["verify", "--verbose", "--print-certs", apk]);
  const badging = command(join(tools, "aapt"), ["dump", "badging", apk]);
  const config = JSON.parse(command("unzip", ["-p", apk, "assets/capacitor.config.json"]));
  return verifyUpgradeMetadata(badging, certificates, config);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const apk = resolve(process.argv[2] ?? "android/app/build/outputs/apk/debug/app-debug.apk");
  console.log("APK signature, metadata and Capacitor checks passed:", verifyBuiltApk(apk, process.env.ANDROID_HOME ?? process.env.ANDROID_SDK_ROOT));
  console.log("This does not verify an update to an existing installation, on-device launch or real client data.");
  } catch (error) {
    console.error(`UPGRADE NOT VERIFIED: ${error.message}`);
    process.exitCode = 1;
  }
}
