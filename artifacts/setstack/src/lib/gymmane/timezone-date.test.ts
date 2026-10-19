import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

const script = `
  import { pathToFileURL } from "node:url";
  import { resolve } from "node:path";
  const load = (path) => import(pathToFileURL(resolve(path)).href);
  const [{ formatCalendarDate }, { analyzeMuscleActivity }, { originalMuscleAnalytics }] =
    await Promise.all([
      load("src/lib/gymmane/calendar-date.ts"),
      load("src/lib/gymmane/muscle-activity.ts"),
      load("src/lib/gymmane/original-muscle-analytics.ts"),
    ]);
  const session = {
    id: "timezone-test",
    date: "2026-10-13",
    durationSec: 900,
    routineId: null,
    name: "Timezone test",
    exercises: [{
      id: "timezone-test-exercise",
      name: "Timezone test exercise",
      primary: "chest",
      equipment: "Other",
      sets: [{ id: "timezone-test-set", reps: 8, weight: 50, kind: "normal", rpe: null }],
    }],
  };
  const client = { sessions: [session] };
  const activity = analyzeMuscleActivity(client, [], 7, "2026-10-19");
  const original = originalMuscleAnalytics(client, [], 7, new Date(2026, 9, 19, 12));
  console.log(JSON.stringify({
    label: formatCalendarDate("2026-10-13", { month: "short", day: "numeric" }, "en-US"),
    activitySets: activity.workingSets,
    activitySessions: activity.completedSessions,
    originalChestSets: original.sets.chest,
  }));
`;

for (const timezone of ["UTC", "America/Los_Angeles"]) {
  test(`date-only workout labels and analytics stay on the stored day in ${timezone}`, () => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--input-type=module", "-e", script],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, TZ: timezone },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      label: "Oct 13",
      activitySets: 1,
      activitySessions: 1,
      originalChestSets: 1,
    });
  });
}
