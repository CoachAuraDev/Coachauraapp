import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function verifyPlayReleaseConfig(gradleText, highestPlayVersionCode) {
  const applicationId = gradleText.match(/^\s*applicationId\s+["']([^"']+)["']\s*$/m)?.[1];
  const versionCodeValue = gradleText.match(/^\s*versionCode\s+(\d+)\s*$/m)?.[1];
  const versionName = gradleText.match(/^\s*versionName\s+["']([^"']+)["']\s*$/m)?.[1];
  if (!applicationId || !versionCodeValue || !versionName) {
    throw new Error("Could not read applicationId, versionCode and versionName from Android Gradle configuration.");
  }
  if (applicationId !== "app.setstack.trainer") {
    throw new Error(`Unexpected application ID ${applicationId}; expected app.setstack.trainer.`);
  }

  const currentVersionCode = Number(versionCodeValue);
  const previousValue = String(highestPlayVersionCode ?? "").trim();
  if (!/^\d+$/.test(previousValue)) {
    throw new Error("Enter the highest versionCode already used in Play Console before building a release AAB.");
  }
  const previousVersionCode = Number(previousValue);
  if (!Number.isSafeInteger(previousVersionCode) || currentVersionCode <= previousVersionCode) {
    throw new Error(`Release versionCode ${currentVersionCode} must be greater than the highest Play Console versionCode (${previousValue}).`);
  }
  return { applicationId, versionCode: currentVersionCode, versionName, previousVersionCode };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const gradlePath = path.resolve("android/app/build.gradle");
    const result = verifyPlayReleaseConfig(
      readFileSync(gradlePath, "utf8"),
      process.env.COACHAURA_HIGHEST_PLAY_VERSION_CODE,
    );
    const report = [
      "Play release version check passed.",
      `Application ID: ${result.applicationId}`,
      `Version: ${result.versionName} (${result.versionCode})`,
      `Previous highest Play versionCode: ${result.previousVersionCode}`,
    ].join("\n");
    console.log(report);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Play release metadata\n\n${report}\n\n`, "utf8");
  } catch (error) {
    console.error(`PLAY RELEASE VALIDATION FAILED: ${error instanceof Error ? error.message : error}`);
    process.exitCode = 1;
  }
}
