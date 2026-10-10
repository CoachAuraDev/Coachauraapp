import test from "node:test";
import assert from "node:assert/strict";
import { weekOverview, recentActivity } from "./dashboard.ts";
import type { Client } from "./models.ts";

// TEST data only.
const mk = (id: string, sessions: unknown[], extra: Partial<Client> = {}) => ({
  id, name: `TEST ${id}`, weeklyGoal: 3, sessions, routines: [], weeklyPlan: { "1": "r" }, bodyweight: [], ...extra,
}) as unknown as Client;
const sess = (date: string) => ({ id: date, date, name: "T", durationSec: 60, routineId: null,
  exercises: [{ id: "e", name: "E", primary: "chest", equipment: "Barbell", sets: [{ id: "s", reps: 5, weight: 100, kind: "normal", rpe: null }] }] });

test("empty data", () => {
  const o = weekOverview([], "2024-05-15");
  assert.equal(o.workouts, 0); assert.equal(o.volume, 0);
  assert.deepEqual(recentActivity([]), []);
});
test("week boundaries Mon-Sun", () => {
  const c = mk("a", [sess("2024-05-12"), sess("2024-05-13"), sess("2024-05-19"), sess("2024-05-20"), { date: "bad" }]);
  const o = weekOverview([c], "2024-05-19");
  assert.equal(o.workouts, 2); assert.equal(o.sets, 2); assert.equal(o.volume, 1000);
  assert.equal(o.activeClients, 1); assert.equal(o.days[0]!.count, 1); assert.equal(o.days[6]!.count, 1);
});
test("recent activity sorted, malformed skipped", () => {
  const c = mk("a", [sess("2024-05-01")], { bodyweight: [{ date: "2024-05-02", kg: 80 }, { date: "x", kg: 1 }] });
  const r = recentActivity([c]);
  assert.equal(r.length, 2); assert.equal(r[0]!.kind, "bodyweight");
});
test("TEST overview excludes future logs, warm-ups and invalid calendar dates without changing records", () => {
  const normal = sess("2024-05-15");
  normal.exercises[0].sets.push({ ...normal.exercises[0].sets[0], id: "test-warmup", kind: "warmup" });
  const client = mk("safe", [normal, sess("2024-05-16"), sess("2024-02-31")], {
    weeklyGoal: 1, weeklyPlan: { "1.5": "r", "1": "missing" },
  });
  const before = JSON.stringify(client);
  const result = weekOverview([client], "2024-05-15");
  assert.equal(result.workouts, 1);
  assert.equal(result.sets, 1);
  assert.equal(result.volume, 500);
  assert.equal(result.done, 1);
  assert.equal(result.days.reduce((sum, d) => sum + d.planned, 0), 0);
  assert.equal(recentActivity([client], 8, "2024-05-15").length, 1);
  assert.equal(JSON.stringify(client), before);
});
