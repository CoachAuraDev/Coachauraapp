import assert from "node:assert/strict";
import test from "node:test";
import { kExercises, type CatalogExercise } from "./catalog.ts";
import {
  analyzeMuscleActivity,
  effortFactorFromRpe,
  intensityForWeeklyEquivalent,
  mapExerciseMuscles,
  type MuscleGroup,
} from "./muscle-activity.ts";
import type { Client, ExerciseLog, SessionLog, SetLog } from "./models.ts";

const today = "2025-03-30";
const bench = kExercises.find((exercise) => exercise.name === "Barbell Bench Press")!;
const dumbbellBench = kExercises.find((exercise) => exercise.name === "Dumbbell Bench Press")!;
const barbellRow = kExercises.find((exercise) => exercise.name === "Barbell Bent Over Row")!;
const fixtureExercise: CatalogExercise = {
  id: "test-leg-extension",
  name: "Test Leg Extension",
  primary: "quadriceps",
  secondary: [],
  equipment: "Machine",
  difficulty: "Beginner",
  mode: "",
};

function set(id: string, kind: "normal" | "warmup", rpe: number | null, reps = 8): SetLog {
  return { id, kind, rpe, reps, weight: 60 };
}

function logExercise(
  exercise: CatalogExercise,
  sets: SetLog[],
  name = exercise.name,
): ExerciseLog {
  return {
    id: exercise.id,
    name,
    primary: exercise.primary,
    equipment: exercise.equipment,
    sets,
  };
}

function session(id: string, date: string, exercises: ExerciseLog[]): SessionLog {
  return { id, date, durationSec: 1800, name: "Test workout", routineId: null, exercises };
}

function client(sessions: SessionLog[]): Client {
  return {
    id: "test-client",
    name: "Test Client",
    sex: "female",
    age: 30,
    heightCm: 170,
    weightKg: 65,
    activity: 1.5,
    weeklyGoal: 3,
    neckCm: null,
    waistCm: null,
    hipCm: null,
    notes: "",
    restSeconds: 90,
    since: "2025-01-01",
    sessions,
    routines: [],
    weeklyPlan: {},
    bodyweight: [],
  };
}

function getMuscle(sessions: SessionLog[], period: 7 | 30, muscle: MuscleGroup, library = kExercises) {
  return analyzeMuscleActivity(client(sessions), library, period, today).muscles.find((item) => item.id === muscle)!;
}

test("GymMane primary/secondary mapping separates pressing and rowing contributions", () => {
  const pressing = mapExerciseMuscles(bench);
  assert.equal(pressing.primary, "chest");
  assert.ok(pressing.secondary.includes("triceps"));
  assert.ok(pressing.secondary.includes("front-deltoids"));

  const row = mapExerciseMuscles(barbellRow);
  assert.equal(row.primary, "upper-back");
  assert.ok(row.secondary.includes("biceps"));
  assert.ok(row.secondary.includes("rear-deltoids"));
  assert.ok(row.secondary.includes("lats"));
});

test("every GymMane catalog exercise maps to at least one supported muscle group", () => {
  for (const exercise of kExercises) {
    const mapping = mapExerciseMuscles(exercise);
    assert.ok(mapping.primary, `${exercise.id} (${exercise.name}) has no primary mapping`);
    assert.ok(
      [...mapping.secondary, mapping.primary].every((group) =>
        ["chest", "front-deltoids", "side-deltoids", "rear-deltoids", "biceps", "triceps",
          "forearms", "upper-back", "lats", "traps", "lower-back", "abs", "obliques",
          "glutes", "quadriceps", "hamstrings", "adductors", "calves"].includes(group),
      ),
      `${exercise.id} (${exercise.name}) maps to an unsupported group`,
    );
  }
});

test("seven- and thirty-day views use completed logs, exclude warm-ups, and show actual sets", () => {
  const sessions = [
    session("recent", "2025-03-24", [
      logExercise(bench, [
        set("work-hard", "normal", 9),
        set("work-moderate", "normal", 7),
        set("warmup", "warmup", 10),
        set("empty", "normal", 9, 0),
      ]),
    ]),
    session("month", "2025-03-02", [
      logExercise(bench, [set("older-one", "normal", 8), set("older-two", "normal", 8)]),
    ]),
    session("outside", "2025-02-28", [
      logExercise(bench, [set("outside-set", "normal", null)]),
    ]),
    session("future", "2025-03-31", [
      logExercise(bench, [set("future-set", "normal", null)]),
    ]),
  ];

  const sevenDay = getMuscle(sessions, 7, "chest");
  assert.equal(sevenDay.directSets, 2);
  assert.equal(sevenDay.indirectSets, 0);
  assert.equal(sevenDay.effectiveSetEquivalents, 2.25);
  assert.equal(sevenDay.selectedPeriodSessions, 1);
  assert.equal(sevenDay.intensity, "low");

  const thirtyDay = getMuscle(sessions, 30, "chest");
  assert.equal(thirtyDay.directSets, 4);
  assert.equal(thirtyDay.indirectSets, 0);
  assert.equal(thirtyDay.effectiveSetEquivalents, 4.25);
  assert.equal(thirtyDay.selectedPeriodSessions, 2);
  assert.ok(Math.abs(thirtyDay.weeklyEquivalent - (4.25 * 7) / 30) < 1e-9);
  assert.equal(analyzeMuscleActivity(client(sessions), kExercises, 7, today).startDate, "2025-03-24");
  assert.equal(analyzeMuscleActivity(client(sessions), kExercises, 30, today).startDate, "2025-03-01");
});

test("secondary muscles receive half set-equivalents while raw sets remain separately countable", () => {
  const oneBench = session("press", "2025-03-30", [
    logExercise(bench, [set("press-set", "normal", 9)]),
  ]);
  const triceps = getMuscle([oneBench], 7, "triceps");
  assert.equal(triceps.directSets, 0);
  assert.equal(triceps.indirectSets, 1);
  assert.equal(triceps.effectiveSetEquivalents, 0.625);
  assert.equal(triceps.contributors[0]?.exerciseName, "Barbell Bench Press");
});

test("contributors merge repeated exercises across sessions without combining different lifts", () => {
  const sessions = [
    session("press-day-one", "2025-03-29", [
      logExercise(bench, [set("bench-day-one", "normal", 9)]),
      logExercise(dumbbellBench, [set("dumbbell-day-one", "normal", 6)]),
    ]),
    session("press-day-two", today, [
      logExercise(bench, [set("bench-day-two", "normal", 8)]),
      logExercise(dumbbellBench, [set("dumbbell-day-two", "normal", 8)]),
    ]),
  ];

  const chest = getMuscle(sessions, 30, "chest");
  const triceps = getMuscle(sessions, 30, "triceps");
  const byExercise = (muscle: typeof chest) => Object.fromEntries(
    muscle.contributors.map((item) => [item.exerciseId, {
      directSets: item.directSets,
      indirectSets: item.indirectSets,
      weightedSets: item.effectiveSetEquivalents,
    }]),
  );

  assert.deepEqual(byExercise(chest), {
    [bench.id]: { directSets: 2, indirectSets: 0, weightedSets: 2.25 },
    [dumbbellBench.id]: { directSets: 2, indirectSets: 0, weightedSets: 1.75 },
  });
  assert.deepEqual(byExercise(triceps), {
    [bench.id]: { directSets: 0, indirectSets: 2, weightedSets: 1.125 },
    [dumbbellBench.id]: { directSets: 0, indirectSets: 2, weightedSets: 0.875 },
  });
  for (const muscle of [chest, triceps]) {
    assert.equal(muscle.contributors.reduce((sum, item) => sum + item.directSets, 0), muscle.directSets);
    assert.equal(muscle.contributors.reduce((sum, item) => sum + item.indirectSets, 0), muscle.indirectSets);
    assert.equal(
      muscle.contributors.reduce((sum, item) => sum + item.effectiveSetEquivalents, 0),
      muscle.effectiveSetEquivalents,
    );
  }
});

test("custom canonical muscle assignments are usable without changing session records", () => {
  const custom: CatalogExercise = {
    ...fixtureExercise,
    id: "custom-press",
    name: "Coach Custom Press",
    primary: "front-deltoids",
    secondary: ["triceps", "side-deltoids"],
  };
  const mapping = mapExerciseMuscles(custom);
  assert.deepEqual(mapping, {
    primary: "front-deltoids",
    secondary: ["triceps", "side-deltoids"],
  });

  const result = analyzeMuscleActivity(
    client([session("custom-session", "2025-03-30", [logExercise(custom, [set("custom-set", "normal", null)])])]),
    [custom],
    7,
    today,
  );
  assert.equal(result.muscles.find((item) => item.id === "front-deltoids")?.directSets, 1);
  assert.equal(result.muscles.find((item) => item.id === "side-deltoids")?.indirectSets, 1);
});

test("recovery reports a high recent workload and ignores a session with only warm-up sets", () => {
  const heavyDays = ["2025-03-25", "2025-03-27", "2025-03-30"];
  const frequentSessions = heavyDays.map((date, index) =>
    session(`legs-${index}`, date, [
      logExercise(fixtureExercise, Array.from({ length: 4 }, (_, setIndex) =>
        set(`leg-${index}-${setIndex}`, "normal", 9),
      )),
    ]),
  );
  assert.equal(getMuscle(frequentSessions, 7, "quadriceps", [fixtureExercise]).recoveryStatus, "high-recent-workload");

  const warmupOnly = session("warmup-only", "2025-03-30", [
    logExercise(fixtureExercise, [set("warmup-leg", "warmup", 10)]),
  ]);
  const empty = getMuscle([warmupOnly], 7, "quadriceps", [fixtureExercise]);
  assert.equal(empty.directSets, 0);
  assert.equal(empty.recoveryStatus, "no-data");
});

test("intensity thresholds and RIR effort bands are stable", () => {
  assert.equal(effortFactorFromRpe(null), 1);
  assert.equal(effortFactorFromRpe(9), 1.25);
  assert.equal(effortFactorFromRpe(8), 1);
  assert.equal(effortFactorFromRpe(6), 0.75);

  assert.equal(intensityForWeeklyEquivalent(0), "none");
  assert.equal(intensityForWeeklyEquivalent(2.99), "low");
  assert.equal(intensityForWeeklyEquivalent(3), "moderate");
  assert.equal(intensityForWeeklyEquivalent(6), "high");
  assert.equal(intensityForWeeklyEquivalent(10), "very-high");
});

test("empty clients return all groups with no-data recovery", () => {
  const result = analyzeMuscleActivity(client([]), kExercises, 30, today);
  assert.equal(result.period, 30);
  assert.equal(result.startDate, "2025-03-01");
  assert.equal(result.endDate, today);
  assert.ok(result.muscles.every((muscle) =>
    muscle.intensity === "none" &&
    muscle.directSets === 0 &&
    muscle.indirectSets === 0 &&
    muscle.recoveryStatus === "no-data",
  ));
});

test("explicit custom mappings are honoured without automatic press support", () => {
  const custom: CatalogExercise = {
    ...fixtureExercise,
    id: "test-explicit-bench",
    name: "TEST custom bench press",
    primary: "chest",
    secondary: ["calves", "chest", "calves"],
    muscleMappingExplicit: true,
  };
  assert.deepEqual(mapExerciseMuscles(custom), { primary: "chest", secondary: ["calves"] });
});

test("client histories stay isolated and unfinished drafts are never counted", () => {
  const first = client([session("test-client-a-session", today, [logExercise(bench, [set("a1", "normal", null), set("a2", "normal", null)])])]);
  const second = { ...client([session("test-client-b-session", today, [logExercise(fixtureExercise, [set("b1", "normal", null)])])]), id: "test-client-b" };
  const library = [...kExercises, fixtureExercise];
  const a = analyzeMuscleActivity(first, library, 7, today);
  const b = analyzeMuscleActivity(second, library, 7, today);
  assert.equal(a.muscles.find((item) => item.id === "chest")!.directSets, 2);
  assert.equal(b.muscles.find((item) => item.id === "chest")!.directSets, 0);
  assert.equal(a.workingSets, 2);
  assert.equal(b.workingSets, 1);
  const unfinished = { ...client([]), draft: session("test-unfinished", today, [logExercise(bench, [set("draft1", "normal", 10)])]) };
  assert.equal(analyzeMuscleActivity(unfinished, library, 7, today).workingSets, 0);
});

test("recovery labels use the latest day and current workload independent of display range", () => {
  assert.equal(getMuscle([session("test-recent", today, [logExercise(bench, [set("r1", "normal", null)])])], 7, "chest").recoveryStatus, "recently-trained");
  const recovering = [session("test-recovering", "2025-03-28", [logExercise(bench, Array.from({ length: 8 }, (_, i) => set(`recovering-${i}`, "normal", null)))])];
  assert.equal(getMuscle(recovering, 7, "chest").recoveryStatus, "recovering");
  assert.equal(getMuscle(recovering, 7, "chest").estimatedRecoveryHours, 72);
  const old = [session("test-old-recovered", "2025-03-20", [logExercise(bench, [set("old", "normal", null)])])];
  const oldSevenDay = getMuscle(old, 7, "chest");
  assert.equal(oldSevenDay.recoveryStatus, "recovered");
  assert.equal(oldSevenDay.directSets, 0);
  assert.equal(oldSevenDay.selectedPeriodSessions, 0);
  assert.equal(oldSevenDay.lastWorkoutDate, "2025-03-20");
  assert.equal(oldSevenDay.daysSinceLastWorkout, 10);
  const oldThirtyDay = getMuscle(old, 30, "chest");
  assert.equal(oldThirtyDay.recoveryStatus, "recovered");
  assert.equal(oldThirtyDay.directSets, 1);
  assert.equal(oldThirtyDay.lastWorkoutDate, "2025-03-20");
  const sameDay = [
    session("test-same-day-am", today, [logExercise(bench, [set("am1", "normal", null), set("am2", "normal", null)])]),
    session("test-same-day-pm", today, [logExercise(bench, [set("pm1", "normal", null), set("pm2", "normal", null)])]),
  ];
  assert.equal(getMuscle(sameDay, 7, "chest").estimatedRecoveryHours, 56);
});

test("unmapped work is disclosed and invalid calendar dates do not enter recovery history", () => {
  const unknown = { ...fixtureExercise, id: "test-unknown", name: "TEST Unmapped Exercise", primary: "other" };
  const result = analyzeMuscleActivity(client([session("test-unmapped", today, [logExercise(unknown, [set("unknown1", "normal", null)])])]), [], 7, today);
  assert.equal(result.workingSets, 1);
  assert.deepEqual(result.unmappedExercises, ["TEST Unmapped Exercise"]);
  assert.ok(result.muscles.every((muscle) => muscle.directSets + muscle.indirectSets === 0));
  const invalid = client([session("test-invalid-date", "2025-02-31", [logExercise(bench, [set("invalid1", "normal", null)])])]);
  assert.ok(analyzeMuscleActivity(invalid, kExercises, 30, today).muscles.every((muscle) => muscle.lastWorkoutDate === null));
  assert.throws(() => analyzeMuscleActivity(client([]), kExercises, 7, "2025-02-31"), /Expected today/);
});
