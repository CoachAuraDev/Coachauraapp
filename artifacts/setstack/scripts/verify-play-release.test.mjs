import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { verifyPlayReleaseConfig } from "./verify-play-release.mjs";

const gradle = readFileSync(new URL("../android/app/build.gradle", import.meta.url), "utf8");

test("release metadata keeps CoachAura's package and requires a newer Play version code", () => {
  assert.deepEqual(verifyPlayReleaseConfig(gradle, "1"), {
    applicationId: "app.setstack.trainer",
    versionCode: 2,
    versionName: "1.0.1",
    previousVersionCode: 1,
  });
});

test("release version validation rejects missing, invalid, equal and higher Play version codes", () => {
  for (const prior of ["", "not-a-number", "-1", "2", "3"]) {
    assert.throws(() => verifyPlayReleaseConfig(gradle, prior));
  }
});

test("release version validation rejects an unexpected application ID or incomplete Gradle metadata", () => {
  assert.throws(() => verifyPlayReleaseConfig(gradle.replaceAll("app.setstack.trainer", "app.other"), "1"), /Unexpected application ID/);
  assert.throws(() => verifyPlayReleaseConfig("android { }", "1"), /Could not read/);
});
