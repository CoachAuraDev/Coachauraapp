import assert from "node:assert/strict";
import test from "node:test";
import {
  ACHIEVEMENT_STORAGE_KEY,
  calculateAchievements,
  markAchievementsCelebrated,
  readAchievementLedger,
  trackClientAchievements,
} from "./achievements.ts";
import { shiftIso } from "./engine.ts";
import type { Client, ExerciseLog, SessionLog, SetLog } from "./models.ts";

function set(id: string, weight = 80, reps = 5, kind: SetLog["kind"] = "normal"): SetLog {
  return { id, weight, reps, kind, rpe: 8 };
}

function exercise(id: string, name = "Barbell bench press", sets = [set(`set-${id}`)]): ExerciseLog {
  return { id, name, primary: "chest", equipment: "barbell", sets };
}

function session(id: string, date: string, exerciseId = "bench", weight = 80, kind: SetLog["kind"] = "normal"): SessionLog {
  return {
    id,
    date,
    durationSec: 1800,
    name: "Strength session",
    routineId: null,
    exercises: [exercise(exerciseId, "Barbell bench press", [set(`set-${id}`, weight, 5, kind)])],
  };
}

function client(sessions: SessionLog[] = [], bodyweight: Client["bodyweight"] = [], id = "client-1"): Client {
  return {
    id,
    name: "Test client",
    sex: "female",
    age: 30,
    heightCm: 170,
    weightKg: 70,
    activity: 1.5,
    weeklyGoal: 3,
    neckCm: null,
    waistCm: null,
    hipCm: null,
    notes: "",
    restSeconds: 90,
    since: "2024-01-01",
    sessions,
    routines: [],
    weeklyPlan: {},
    bodyweight,
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    values,
  };
}

const ids = (records: { id: string }[]) => new Set(records.map((record) => record.id));

test("empty clients and warm-up-only or future logs do not earn workout or strength badges", () => {
  assert.equal(calculateAchievements(client(), "2025-01-31").length, 0);
  const onlyWarmup = client([
    session("warm-up", "2025-01-01", "bench", 60, "warmup"),
    session("future", "2030-01-01"),
  ]);
  assert.equal(calculateAchievements(onlyWarmup, "2025-01-31").length, 0);
});

test("saved workout, strength and lift milestones use actual saved working sets", () => {
  const result = calculateAchievements(client([session("a", "2025-01-01")]), "2025-01-31");
  assert.deepEqual(ids(result), new Set(["first-workout", "first-personal-record", "bench-press-milestone"]));
  const firstRecord = result.find((award) => award.id === "first-personal-record");
  assert.equal(firstRecord?.unlockedAt, "2025-01-01");
  assert.match(firstRecord?.milestone ?? "", /Barbell bench press: 80 kg × 5 reps; estimated 1RM/);
  assert.equal(result.some((award) => award.id === "new-estimated-1rm"), false);
});

test("a zero-load working set can mark a lift milestone but cannot fabricate an estimated 1RM", () => {
  const bodyweightBench = session("bodyweight-bench", "2025-01-01", "bench", 0);
  const result = calculateAchievements(client([bodyweightBench]), "2025-01-31");
  assert.ok(ids(result).has("first-workout"));
  assert.ok(ids(result).has("bench-press-milestone"));
  assert.equal(ids(result).has("first-personal-record"), false);
  assert.match(result.find((award) => award.id === "bench-press-milestone")?.milestone ?? "", /estimated 1RM is unavailable/);
});

test("workout count thresholds use distinct saved sessions and exclude duplicate session IDs", () => {
  const history = Array.from({ length: 100 }, (_, index) =>
    session(`session-${index}`, shiftIso("2024-01-01", index * 7), "bench", 60 + index));
  history.push(session("session-0", "2025-12-30", "bench", 200));
  const result = calculateAchievements(client(history), "2026-01-01");
  for (const milestone of ["first-workout", "workouts-10", "workouts-25", "workouts-50", "workouts-100"]) {
    assert.ok(ids(result).has(milestone), `${milestone} should be earned`);
  }
  assert.ok(ids(result).has("four-week-streak"));
  assert.ok(ids(result).has("ten-weeks-consistent"));
  assert.equal(result.find((award) => award.id === "ten-weeks-consistent")?.unlockedAt, shiftIso("2024-01-01", 9 * 7));
  assert.equal(result.find((award) => award.id === "workouts-100")?.unlockedAt, shiftIso("2024-01-01", 99 * 7));
});

test("squat and deadlift milestones use the logged exercise names and working sets", () => {
  const trainingSession = {
    ...session("lifts", "2025-01-01"),
    exercises: [
      exercise("squat", "Barbell back squat"),
      exercise("deadlift", "Conventional deadlift"),
    ],
  };
  const result = ids(calculateAchievements(client([trainingSession]), "2025-01-31"));
  assert.ok(result.has("squat-milestone"));
  assert.ok(result.has("deadlift-milestone"));
});

test("estimated 1RM record only unlocks when a later saved set improves the same exercise record", () => {
  const equalOrLower = client([session("a", "2025-01-01", "bench", 80), session("b", "2025-01-02", "bench", 80)]);
  assert.equal(ids(calculateAchievements(equalOrLower, "2025-01-31")).has("new-estimated-1rm"), false);
  const improved = client([session("a", "2025-01-01", "bench", 80), session("b", "2025-01-02", "bench", 90)]);
  const newRecord = calculateAchievements(improved, "2025-01-31").find((award) => award.id === "new-estimated-1rm");
  assert.equal(newRecord?.unlockedAt, "2025-01-02");
  assert.match(newRecord?.milestone ?? "", /90 kg × 5 reps/);
});

test("consistency milestones respect Monday-to-Sunday ISO week boundaries and gaps", () => {
  const dates = ["2025-01-06", "2025-01-10", "2025-01-12", "2025-01-13", "2025-01-20", "2025-01-27"];
  const result = calculateAchievements(client(dates.map((date, index) => session(`s-${index}`, date))), "2025-02-01");
  assert.equal(result.find((award) => award.id === "three-workouts-one-week")?.unlockedAt, "2025-01-12");
  assert.equal(result.find((award) => award.id === "four-week-streak")?.unlockedAt, "2025-01-27");

  const withGap = dates.filter((date) => date !== "2025-01-20").map((date, index) => session(`gap-${index}`, date));
  assert.equal(ids(calculateAchievements(client(withGap), "2025-02-01")).has("four-week-streak"), false);
});

test("bodyweight tracking uses dated measurements and 30 calendar days is inclusive", () => {
  const atThirtyDays = client([], [
    { date: "2025-01-01", kg: 70 },
    { date: "2025-01-31", kg: 69.5 },
    { date: "2030-01-01", kg: 60 },
  ]);
  const result = calculateAchievements(atThirtyDays, "2025-02-01");
  assert.equal(result.find((award) => award.id === "first-body-measurement")?.unlockedAt, "2025-01-01");
  assert.equal(result.find((award) => award.id === "thirty-days-tracking")?.unlockedAt, "2025-01-31");

  const atTwentyNineDays = client([], [{ date: "2025-01-01", kg: 70 }, { date: "2025-01-30", kg: 69 }]);
  assert.equal(ids(calculateAchievements(atTwentyNineDays, "2025-02-01")).has("thirty-days-tracking"), false);
});

test("only the client's own history contributes to their achievements", () => {
  const clients = [
    client([session("a", "2025-01-01")], [], "client-a"),
    client([], [], "client-b"),
  ];
  const storage = memoryStorage();
  const initial = trackClientAchievements(storage, clients, "2025-01-31");
  assert.equal(initial.ok, true);
  const ledger = readAchievementLedger(storage);
  assert.equal(ledger.ok, true);
  if (ledger.ok) {
    assert.ok(ledger.ledger.clients["client-a"]?.awards["first-workout"]);
    assert.equal(ledger.ledger.clients["client-b"]?.awards["first-workout"], undefined);
  }
  assert.equal(calculateAchievements(clients[1]!, "2025-01-31").length, 0);
});

test("deleting a client also removes only that client's achievement sidecar", () => {
  const storage = memoryStorage();
  trackClientAchievements(storage, [client([session("a", "2025-01-01")], [], "removed-client")], "2025-01-31");
  const workspaceBefore = JSON.stringify({ clients: ["kept-workspace-data"] });
  storage.values.set("setstack-v1", workspaceBefore);
  const afterDeletion = trackClientAchievements(storage, [], "2025-01-31");
  assert.equal(afterDeletion.ok, true);
  const ledger = readAchievementLedger(storage);
  assert.equal(ledger.ok, true);
  if (ledger.ok) assert.deepEqual(ledger.ledger.clients, {});
  assert.equal(storage.values.get("setstack-v1"), workspaceBefore, "Pruning the sidecar must not write the main client store");
});

test("existing records are silently baselined, then newly earned badges persist once across scans and restarts", () => {
  const storage = memoryStorage();
  const existingClient = client([session("existing", "2025-01-01")]);
  const baseline = trackClientAchievements(storage, [existingClient], "2025-01-31");
  assert.equal(baseline.ok, true);
  const afterBaseline = readAchievementLedger(storage);
  assert.equal(afterBaseline.ok, true);
  if (afterBaseline.ok) {
    assert.deepEqual(afterBaseline.ledger.clients["client-1"]?.pending, []);
    assert.equal(afterBaseline.ledger.clients["client-1"]?.awards["first-workout"]?.celebrated, true);
  }

  const newHistory = client([session("existing", "2025-01-01"), session("new", "2025-01-02", "bench", 90)]);
  const newlyTracked = trackClientAchievements(storage, [newHistory], "2025-01-31");
  assert.equal(newlyTracked.ok, true);
  if (newlyTracked.ok) {
    assert.ok(newlyTracked.ledger.clients["client-1"]?.pending.includes("new-estimated-1rm"));
  }
  const repeatedScan = trackClientAchievements(storage, [newHistory], "2025-01-31");
  assert.equal(repeatedScan.ok, true);
  if (repeatedScan.ok) {
    assert.equal(repeatedScan.ledger.clients["client-1"]?.pending.filter((id) => id === "new-estimated-1rm").length, 1);
  }

  const restoredStorage = memoryStorage({ [ACHIEVEMENT_STORAGE_KEY]: storage.values.get(ACHIEVEMENT_STORAGE_KEY)! });
  const restored = readAchievementLedger(restoredStorage);
  assert.equal(restored.ok, true);
  const marked = markAchievementsCelebrated(restoredStorage, "client-1", ["new-estimated-1rm"]);
  assert.equal(marked.ok, true);
  const afterRestart = readAchievementLedger(restoredStorage);
  assert.equal(afterRestart.ok, true);
  if (afterRestart.ok) {
    assert.deepEqual(afterRestart.ledger.clients["client-1"]?.pending, []);
    assert.equal(afterRestart.ledger.clients["client-1"]?.awards["new-estimated-1rm"]?.celebrated, true);
  }
});

test("invalid dates do not create achievements and invalid ledger data is not overwritten", () => {
  assert.equal(calculateAchievements(client([session("bad-date", "2025-02-30")]), "2025-03-01").length, 0);
  const storage = memoryStorage({ [ACHIEVEMENT_STORAGE_KEY]: "{broken" });
  const tracking = trackClientAchievements(storage, [], "2025-03-01");
  assert.equal(tracking.ok, false);
  assert.equal(storage.values.get(ACHIEVEMENT_STORAGE_KEY), "{broken");
});
