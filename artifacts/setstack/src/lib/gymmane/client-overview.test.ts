import assert from "node:assert/strict";
import test from "node:test";
import type { Client, ExerciseLog, SessionLog, SetLog } from "./models.ts";
import {
  estimatedStrengthHistory,
  muscleBalanceRadar,
  muscleTargetGuidance,
  strengthExerciseOptions,
  weeklySetPoints,
} from "./client-overview.ts";

function set(id: string, weight: number, reps = 8, kind: SetLog["kind"] = "normal"): SetLog {
  return { id, weight, reps, kind, rpe: null };
}

function exercise(id: string, name: string, sets: SetLog[], primary = "chest"): ExerciseLog {
  return { id, name, primary, equipment: "Barbell", sets };
}

function session(id: string, date: string, exercises: ExerciseLog[]): SessionLog {
  return { id, date, durationSec: 1200, name: "Logged workout", routineId: null, exercises };
}

function client(sessions: SessionLog[]): Client {
  return {
    id: "overview-test-client",
    name: "Overview Test",
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
    since: "2026-01-01",
    sessions,
    routines: [],
    weeklyPlan: {},
    bodyweight: [],
  };
}

test("weekly set points use Monday–Sunday, count work sets only, and leave future days empty", () => {
  const athlete = client([
    session("sunday", "2026-10-11", [exercise("bench", "Bench", [set("s0", 60)])]),
    session("monday", "2026-10-12", [
      exercise("bench", "Bench", [set("s1", 60), set("s2", 60), set("wu", 30, 8, "warmup"), set("empty", 60, 0)]),
    ]),
    session("today", "2026-10-15", [exercise("row", "Row", [set("s3", 45)])]),
    session("future", "2026-10-16", [exercise("bench", "Bench", [set("s4", 60)])]),
  ]);

  const points = weeklySetPoints(athlete, "2026-10-15");
  assert.deepEqual(points.map(({ day, sets }) => [day, sets]), [
    ["Mon", 2], ["Tue", 0], ["Wed", 0], ["Thu", 1], ["Fri", 0], ["Sat", 0], ["Sun", 0],
  ]);
  assert.equal(points[3]?.isToday, true);
  assert.equal(points[4]?.isFuture, true);
});

test("strength options and history are based on valid completed working sets", () => {
  const athlete = client([
    session("first", "2026-10-10", [
      exercise("leg-extension", "Leg Extension", [set("one", 60, 10)]),
      exercise("warmup-only", "Warmup Only", [set("wu", 100, 8, "warmup")]),
    ]),
    session("second", "2026-10-14", [
      exercise("leg-extension", "Leg Extension", [set("two", 80, 5), set("heavy-warmup", 200, 5, "warmup")]),
    ]),
    session("future", "2026-10-17", [exercise("future-lift", "Future Lift", [set("future-set", 90)])]),
    session("invalid", "2026-02-30", [exercise("bad-date", "Bad Date", [set("bad", 90)])]),
  ]);

  assert.deepEqual(strengthExerciseOptions(athlete, "2026-10-15").map(({ id, name }) => [id, name]), [
    ["leg-extension", "Leg Extension"],
  ]);
  const history = estimatedStrengthHistory(athlete, "leg-extension", "2026-10-15");
  assert.equal(history.length, 2);
  assert.equal(history[0]?.date, "2026-10-10");
  assert.equal(history[1]?.date, "2026-10-14");
  assert.ok(history[1]!.e1rm > history[0]!.e1rm);
  assert.equal(estimatedStrengthHistory(client([]), "leg-extension", "2026-10-15").length, 0);
});

test("muscle radar combines detailed mapped stimulus without adding invented values", () => {
  const radar = muscleBalanceRadar([
    { id: "chest", weeklyEquivalent: 5 },
    { id: "front-deltoids", weeklyEquivalent: 2 },
    { id: "side-deltoids", weeklyEquivalent: 1 },
    { id: "rear-deltoids", weeklyEquivalent: 3 },
    { id: "abs", weeklyEquivalent: 4 },
    { id: "obliques", weeklyEquivalent: 1 },
  ]);
  assert.equal(radar.find((item) => item.label === "Chest")?.weeklyEquivalent, 5);
  assert.equal(radar.find((item) => item.label === "Shoulders")?.weeklyEquivalent, 6);
  assert.equal(radar.find((item) => item.label === "Core")?.weeklyEquivalent, 5);
  assert.equal(radar.find((item) => item.label === "Glutes")?.weeklyEquivalent, 0);
});

test("muscle coaching guidance compares only explicitly configured targets", () => {
  const radar = muscleBalanceRadar([
    { id: "chest", weeklyEquivalent: 4 },
    { id: "front-deltoids", weeklyEquivalent: 2 },
    { id: "side-deltoids", weeklyEquivalent: 1 },
    { id: "rear-deltoids", weeklyEquivalent: 1 },
  ]);
  const guidance = muscleTargetGuidance(radar, { chest: 5, shoulders: 4 });
  assert.deepEqual(
    guidance.filter((group) => group.target !== undefined).map(({ id, weeklyEquivalent, target, belowTarget }) => ({
      id, weeklyEquivalent, target, belowTarget,
    })),
    [
      { id: "chest", weeklyEquivalent: 4, target: 5, belowTarget: true },
      { id: "shoulders", weeklyEquivalent: 4, target: 4, belowTarget: false },
    ],
  );
  assert.equal(guidance.find((group) => group.id === "arms")?.target, undefined);
  assert.equal(guidance.find((group) => group.id === "arms")?.belowTarget, false);
  assert.equal(muscleTargetGuidance(radar).every((group) => group.target === undefined && !group.belowTarget), true);
});
