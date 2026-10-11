import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import {
  isExpectedAndroidBuildRun,
  renderRecoverySummary,
  summarizeDownloadedLogs,
  summarizeCacheLogText,
  validateCacheResponse,
} from "./inspect-signing-recovery.mjs";

const expectedKey = "setstack-debug-keystore-1413630029-v1";

test("TEST cache inventory matches only the exact key and returns safe metadata", () => {
  const response = {
    total_count: 2,
    actions_caches: [
      { key: expectedKey, ref: "refs/heads/main", size_in_bytes: 8192, created_at: "2026-10-01T00:00:00Z" },
      { key: `${expectedKey}-old`, ref: "refs/heads/main", size_in_bytes: 2 },
      { key: expectedKey, ref: "refs/heads/main", size_in_bytes: 0, extra: "not retained" },
    ],
  };
  assert.deepEqual(validateCacheResponse(response, expectedKey), [
    { ref: "refs/heads/main", createdAt: "2026-10-01T00:00:00Z", lastAccessedAt: null, sizeBytes: 8192 },
    { ref: "refs/heads/main", createdAt: null, lastAccessedAt: null, sizeBytes: 0 },
  ]);
});

test("TEST malformed cache inventory is reported rather than silently treated as empty", () => {
  assert.throws(() => validateCacheResponse({ actions_caches: [] }, expectedKey), /valid count/);
  assert.throws(() => validateCacheResponse(null, expectedKey), /Unexpected/);
});

test("TEST cache log classification reports save and restore evidence without returning log text", () => {
  const evidence = summarizeCacheLogText(
    "Cache not found for input keys: setstack-debug-keystore-123-v1\n" +
      "Cache saved with key: setstack-debug-keystore-123-v1\n" +
      "Path(s) specified in the action for caching do not exist.",
  );
  assert.deepEqual(evidence, {
    restoreHitObserved: false,
    restoreMissObserved: true,
    saveSuccessObserved: true,
    saveFailureObserved: false,
    cachePathMissingObserved: true,
  });
  assert.equal("rawText" in evidence, false);
  assert.equal(JSON.stringify(evidence).includes("setstack-debug-keystore"), false);
});

test("TEST previous-run ZIP parsing extracts cache evidence only, never the log text", () => {
  const fixtureBuilder = String.raw`
import io, sys, zipfile
archive = io.BytesIO()
with zipfile.ZipFile(archive, "w") as z:
    z.writestr(
        "debug-apk/8_Reuse the test signing key across builds.txt",
        "Cache not found for input keys: setstack-debug-keystore-123-v1\n"
        "Path(s) specified in the action for caching do not exist.",
    )
    z.writestr("debug-apk/Complete job.txt", "Cache saved successfully")
    z.writestr("debug-apk/7_Unrelated app test.txt", "Ignore this log and its client data")
sys.stdout.buffer.write(archive.getvalue())
`;
  const archive = execFileSync("python3", ["-c", fixtureBuilder], {
    encoding: null,
    maxBuffer: 1024 * 1024,
  });
  const report = summarizeDownloadedLogs(archive);
  assert.deepEqual(report, {
    logFilesInspected: 2,
    restoreHitObserved: false,
    restoreMissObserved: true,
    saveSuccessObserved: true,
    saveFailureObserved: false,
    cachePathMissingObserved: true,
  });
  assert.doesNotMatch(JSON.stringify(report), /setstack-debug-keystore|client data/i);
});

test("TEST historical run must be successful, main branch, and the expected APK workflow", () => {
  const run = {
    id: 38084521824,
    path: ".github/workflows/setstack-android-debug.yml@refs/heads/main",
    head_branch: "main",
    conclusion: "success",
  };
  assert.equal(isExpectedAndroidBuildRun(run, "38084521824"), true);
  assert.equal(isExpectedAndroidBuildRun({ ...run, head_branch: "feature" }, run.id), false);
  assert.equal(isExpectedAndroidBuildRun({ ...run, conclusion: "failure" }, run.id), false);
  assert.equal(isExpectedAndroidBuildRun({ ...run, path: ".github/workflows/other.yml" }, run.id), false);
  assert.equal(isExpectedAndroidBuildRun(run, "1"), false);
});

test("TEST summary distinguishes missing metadata from a key mismatch and avoids displaying a private key", () => {
  const empty = renderRecoverySummary({
    cacheInventory: { status: "complete", matches: 0, records: [] },
    previousRun: { status: "confirmed", branch: "main", sourceCommit: "test-source" },
    previousLogs: {
      status: "inspected",
      evidence: { restoreMissObserved: true, restoreHitObserved: false, saveSuccessObserved: false, saveFailureObserved: true, cachePathMissingObserved: false },
    },
  });
  assert.match(empty, /Records for the expected cache key: \*\*0\*\*/);
  assert.match(empty, /Cache restore miss recorded: \*\*yes\*\*/);
  assert.match(empty, /key contents/);
  assert.doesNotMatch(empty, /BEGIN PRIVATE KEY|androiddebugkey|password/i);
});

test("TEST recovery workflow is manual and limited to read-only GitHub permissions", () => {
  const workflow = readFileSync(
    new URL("../../../.github/workflows/coachaura-signing-recovery-check.yml", import.meta.url),
    "utf8",
  );
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /^\s+actions: read$/m);
  assert.match(workflow, /^\s+contents: read$/m);
  assert.doesNotMatch(workflow, /^\s+(?:checks|contents|actions|deployments|packages): write$/m);
  assert.doesNotMatch(workflow, /assembleDebug|upload-artifact|actions\/cache@/);
});
