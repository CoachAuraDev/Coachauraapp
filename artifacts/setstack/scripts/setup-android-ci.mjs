import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// GitHub's pinned Ubuntu 24.04 image already provides the SDK. Avoid a
// third-party action replacing/downgrading those command-line tools.
export function setupAndroidSdk({
  sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT,
  githubEnvFile = process.env.GITHUB_ENV,
  githubPathFile = process.env.GITHUB_PATH,
  runCommand = spawnSync,
} = {}) {
  if (!sdkRoot) throw new Error("Android SDK path is missing: ANDROID_HOME / ANDROID_SDK_ROOT is not set.");
  const sdkManager = path.join(sdkRoot, "cmdline-tools/latest/bin/sdkmanager");
  if (!existsSync(sdkManager)) throw new Error(`Preinstalled sdkmanager is missing: ${sdkManager}`);
  console.info(`Using the runner's Android SDK: ${sdkRoot}`);

  function checked(label, args, input) {
    console.info(`Android setup: ${label}`);
    const result = runCommand(sdkManager, args, {
      input,
      stdio: ["pipe", "inherit", "inherit"],
      timeout: 600_000,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      throw new Error(`${label} failed: exit ${result.status}, signal ${result.signal ?? "none"}. See the sdkmanager output above.`);
    }
  }

  checked("command-line tools version", ["--version"]);
  // Finite stdin avoids the `yes | sdkmanager` SIGPIPE/pipefail problem.
  // Both commands retain their real exit codes and stream all diagnostics.
  const accept = "y\n".repeat(200);
  checked("accept SDK licences", [`--sdk_root=${sdkRoot}`, "--licenses"], accept);
  checked("install Android 36 platform and build tools", [
    `--sdk_root=${sdkRoot}`, "--install", "platforms;android-36", "build-tools;36.0.0",
  ], accept);
  for (const expected of ["platforms/android-36/android.jar", "build-tools/36.0.0/aapt2"]) {
    if (!existsSync(path.join(sdkRoot, expected))) {
      throw new Error(`SDK installation returned success but a required file is missing: ${expected}`);
    }
  }
  if (githubEnvFile) appendFileSync(githubEnvFile, `ANDROID_HOME=${sdkRoot}\nANDROID_SDK_ROOT=${sdkRoot}\n`);
  if (githubPathFile) appendFileSync(githubPathFile, `${path.dirname(sdkManager)}\n${path.join(sdkRoot, "platform-tools")}\n`);
  console.info("Android SDK 36 is ready for Gradle.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    setupAndroidSdk();
  } catch (error) {
    console.error("Android SDK setup failed:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
