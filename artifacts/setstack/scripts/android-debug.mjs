import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const android = path.join(root, "android");
const java = spawnSync("java", ["-version"], { stdio: "inherit" });
if (java.error || java.status !== 0) {
  console.error("APK NOT CREATED: Java/JDK is unavailable. Install JDK 21 and Android SDK 36, or use the included GitHub Actions workflow. See docs/android-testing.md.");
  process.exit(1);
}
const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
if ((!sdk || !existsSync(sdk)) && !existsSync(path.join(android, "local.properties"))) {
  console.error("APK NOT CREATED: Android SDK is unavailable. Set ANDROID_HOME to your SDK directory or open android/ in Android Studio to configure local.properties. See docs/android-testing.md.");
  process.exit(1);
}
const windows = process.platform === "win32";
const result = spawnSync(windows ? "gradlew.bat" : "./gradlew", ["assembleDebug", "--no-daemon"], {
  cwd: android,
  stdio: "inherit",
  shell: windows,
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const apk = path.join(android, "app/build/outputs/apk/debug/app-debug.apk");
if (!existsSync(apk)) {
  console.error("Gradle returned success but the APK is missing:", apk);
  process.exit(1);
}
console.info(`DEBUG APK CREATED: ${apk}`);
