import { appendFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_API_OUTPUT = 4 * 1024 * 1024;
const MAX_LOG_ARCHIVE = 30 * 1024 * 1024;
const MAX_CACHE_PAGES = 20;
const CACHE_LOG_SUMMARY_SCRIPT = String.raw`
import io, json, re, sys, zipfile

result = {
    "logFilesInspected": 0,
    "restoreHitObserved": False,
    "restoreMissObserved": False,
    "saveSuccessObserved": False,
    "saveFailureObserved": False,
    "cachePathMissingObserved": False,
}
try:
    archive = zipfile.ZipFile(io.BytesIO(sys.stdin.buffer.read()))
    parts = []
    for info in archive.infolist():
        name = info.filename.lower()
        selected = name.endswith(".txt") and (
            "reuse the test signing key" in name
            or "complete job" in name
            or name.endswith("/0_debug-apk.txt")
            or name == "0_debug-apk.txt"
        )
        if selected:
            parts.append(archive.read(info).decode("utf-8", errors="replace"))
    text = "\n".join(parts)
    flat = re.sub(r"\s+", " ", text).lower()
    result["logFilesInspected"] = len(parts)
    result["restoreMissObserved"] = (
        "cache not found for input keys:" in flat
        or "failed to restore cache" in flat
    )
    result["restoreHitObserved"] = (
        "cache restored from key:" in flat
        or "cache hit occurred on the primary key" in flat
    )
    result["saveSuccessObserved"] = (
        "cache saved with key:" in flat
        or "cache saved successfully" in flat
    )
    result["saveFailureObserved"] = (
        "failed to save cache" in flat
        or "unable to reserve cache" in flat
        or "cache save failed" in flat
    )
    result["cachePathMissingObserved"] = (
        "path(s) specified in the action for caching do not exist" in flat
        or "path specified in the action for caching does not exist" in flat
    )
except Exception:
    result["archiveUnavailable"] = True

print(json.dumps(result, separators=(",", ":")))
`;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateCacheResponse(payload, expectedKey) {
  if (!isPlainObject(payload) || !Array.isArray(payload.actions_caches)) {
    throw new Error("Unexpected Actions cache inventory response");
  }
  if (!Number.isInteger(payload.total_count) || payload.total_count < 0) {
    throw new Error("Actions cache inventory did not include a valid count");
  }

  return payload.actions_caches
    .filter((entry) => isPlainObject(entry) && entry.key === expectedKey)
    .map((entry) => ({
      ref: typeof entry.ref === "string" ? entry.ref : null,
      createdAt: typeof entry.created_at === "string" ? entry.created_at : null,
      lastAccessedAt: typeof entry.last_accessed_at === "string" ? entry.last_accessed_at : null,
      sizeBytes: Number.isFinite(entry.size_in_bytes) ? entry.size_in_bytes : null,
    }));
}

export function summarizeCacheLogText(text) {
  const flat = String(text).replace(/\s+/g, " ").toLowerCase();
  return {
    restoreHitObserved:
      flat.includes("cache restored from key:") ||
      flat.includes("cache hit occurred on the primary key"),
    restoreMissObserved:
      flat.includes("cache not found for input keys:") ||
      flat.includes("failed to restore cache"),
    saveSuccessObserved:
      flat.includes("cache saved with key:") ||
      flat.includes("cache saved successfully"),
    saveFailureObserved:
      flat.includes("failed to save cache") ||
      flat.includes("unable to reserve cache") ||
      flat.includes("cache save failed"),
    cachePathMissingObserved:
      flat.includes("path(s) specified in the action for caching do not exist") ||
      flat.includes("path specified in the action for caching does not exist"),
  };
}

export function isExpectedAndroidBuildRun(run, expectedRunId) {
  if (!isPlainObject(run) || String(run.id) !== String(expectedRunId)) return false;
  const workflowPath = typeof run.path === "string" ? run.path.split("@refs/")[0] : "";
  return (
    workflowPath === ".github/workflows/setstack-android-debug.yml" &&
    run.head_branch === "main" &&
    run.conclusion === "success"
  );
}

function runGh(args, { binaryOutput = false, timeout = 30_000 } = {}) {
  const result = spawnSync("gh", args, {
    encoding: binaryOutput ? null : "utf8",
    maxBuffer: binaryOutput ? MAX_LOG_ARCHIVE : MAX_API_OUTPUT,
    timeout,
  });
  if (result.error || result.status !== 0 || result.signal) {
    throw new Error("GitHub API request was unavailable");
  }
  return result.stdout;
}

function getJson(path) {
  const output = runGh([
    "api",
    "--method",
    "GET",
    "--header",
    "Accept: application/vnd.github+json",
    "--header",
    "X-GitHub-Api-Version: 2022-11-28",
    path,
  ]);
  return JSON.parse(output);
}

function validateRepository(repository) {
  if (typeof repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    throw new Error("GitHub repository context is invalid");
  }
  return repository;
}

function assertSafeCacheKey(key) {
  if (typeof key !== "string" || !/^setstack-debug-keystore-\d+-v\d+$/.test(key)) {
    throw new Error("Expected CoachAura signing-cache identifier is invalid");
  }
  return key;
}

export function summarizeDownloadedLogs(buffer) {
  const result = spawnSync(
    "python3",
    ["-c", CACHE_LOG_SUMMARY_SCRIPT],
    {
      input: buffer,
      encoding: "utf8",
      maxBuffer: 64 * 1024,
      timeout: 20_000,
    },
  );
  if (result.error || result.status !== 0 || result.signal) {
    return { archiveUnavailable: true };
  }
  try {
    const parsed = JSON.parse(result.stdout);
    return isPlainObject(parsed) ? parsed : { archiveUnavailable: true };
  } catch {
    return { archiveUnavailable: true };
  }
}

export function renderRecoverySummary(report) {
  const lines = [
    "## CoachAura signing-key recovery check",
    "",
    "**Read-only inspection:** no signing key was opened, restored, created, or uploaded. No APK was built and no phone data was touched.",
    "",
    `- Cache inventory: **${report.cacheInventory.status}**`,
    `- Records for the expected cache key: **${report.cacheInventory.matches === null ? "unknown" : report.cacheInventory.matches}**`,
  ];

  if (report.cacheInventory.matches > 0) {
    lines.push(
      `- Exact-key cache record metadata: ${report.cacheInventory.records
        .map((record) => `${record.ref ?? "unknown ref"}, ${record.sizeBytes ?? "unknown size"} bytes`)
        .join("; ")}`,
    );
    lines.push("- A cache record is metadata only; it does **not** prove its certificate matches the phone.");
  }

  lines.push(
    `- Previous build run: **${report.previousRun.status}**`,
    `- Its cache-step logs: **${report.previousLogs.status}**`,
  );
  if (report.previousRun.status === "confirmed") {
    lines.push(
      `- Previous build source: \`${report.previousRun.sourceCommit}\` on \`${report.previousRun.branch}\``,
    );
  }

  if (report.previousLogs.status === "inspected") {
    const evidence = report.previousLogs.evidence;
    lines.push(
      `  - Cache restore miss recorded: **${evidence.restoreMissObserved ? "yes" : "no"}**`,
      `  - Cache restore hit recorded: **${evidence.restoreHitObserved ? "yes" : "no"}**`,
      `  - Cache save success recorded: **${evidence.saveSuccessObserved ? "yes" : "no"}**`,
      `  - Cache save failure recorded: **${evidence.saveFailureObserved ? "yes" : "no"}**`,
      `  - Missing cache-path warning recorded: **${evidence.cachePathMissingObserved ? "yes" : "no"}**`,
    );
  }

  lines.push(
    "",
    "A missing record or missing log is inconclusive about copies outside GitHub Actions. This check never retrieves or changes cached key contents.",
  );
  return `${lines.join("\n")}\n`;
}

function runMetadataReport(repository, runId) {
  const run = getJson(`repos/${repository}/actions/runs/${runId}`);
  if (!isExpectedAndroidBuildRun(run, runId)) {
    return { status: "not the successful main-branch Android build" };
  }

  const build = {
    status: "confirmed",
    branch: run.head_branch,
    sourceCommit: typeof run.head_sha === "string" ? run.head_sha : "unknown",
  };

  let archive;
  try {
    archive = runGh(
      [
        "api",
        "--method",
        "GET",
        "--header",
        "Accept: application/vnd.github+json",
        "--header",
        "X-GitHub-Api-Version: 2022-11-28",
        `repos/${repository}/actions/runs/${runId}/logs`,
      ],
      { binaryOutput: true, timeout: 45_000 },
    );
  } catch {
    return { build, logs: { status: "not available from GitHub" } };
  }

  if (!Buffer.isBuffer(archive) || archive.length === 0 || archive.length > MAX_LOG_ARCHIVE) {
    return { build, logs: { status: "archive empty or over the safe size limit" } };
  }

  const evidence = summarizeDownloadedLogs(archive);
  if (evidence.archiveUnavailable || evidence.logFilesInspected === 0) {
    return { build, logs: { status: "cache-step logs not present in retained archive" } };
  }
  return { build, logs: { status: "inspected", evidence } };
}

function getCacheInventory(repository, expectedKey) {
  let totalCount;
  const matches = [];

  for (let page = 1; page <= MAX_CACHE_PAGES; page += 1) {
    const payload = getJson(
      `repos/${repository}/actions/caches?per_page=100&page=${page}`,
    );
    const pageMatches = validateCacheResponse(payload, expectedKey);
    matches.push(...pageMatches);
    totalCount = payload.total_count;
    if (page * 100 >= totalCount) {
      return { status: "complete", matches: matches.length, records: matches };
    }
  }
  return { status: "partial; repository has more cache pages", matches: matches.length, records: matches };
}

function writeSummary(text) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (typeof summaryPath === "string" && summaryPath.length > 0) {
    appendFileSync(summaryPath, text, "utf8");
  } else {
    process.stdout.write(text);
  }
}

async function main() {
  let cacheInventory = { status: "unavailable (permission, request, or response issue)", matches: null, records: [] };
  let previousRun = { status: "not inspected" };
  let previousLogs = { status: "not inspected" };
  let repository;
  let expectedKey;
  let runId;

  try {
    repository = validateRepository(process.env.GITHUB_REPOSITORY);
    expectedKey = assertSafeCacheKey(process.env.COACHAURA_SIGNING_CACHE_KEY);
    runId = process.env.COACHAURA_PREVIOUS_RUN_ID;
    if (typeof runId !== "string" || !/^\d{1,20}$/.test(runId)) {
      throw new Error("Previous run ID is invalid");
    }
  } catch {
    // Keep raw environment/context details out of the GitHub Actions log.
  }
  if (repository && expectedKey && runId) {
    try {
      cacheInventory = getCacheInventory(repository, expectedKey);
    } catch {
      // Still try the independent run-log lookup if the cache endpoint is unavailable.
    }
    try {
      const previous = runMetadataReport(repository, runId);
      if (previous.build) {
        previousRun = previous.build;
        previousLogs = previous.logs;
      } else {
        previousRun = { status: previous.status };
      }
    } catch {
      previousRun = { status: "not available from GitHub or not the expected run" };
    }
  }

  writeSummary(renderRecoverySummary({ cacheInventory, previousRun, previousLogs }));
  if (cacheInventory.status.startsWith("unavailable") && previousRun.status !== "confirmed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
