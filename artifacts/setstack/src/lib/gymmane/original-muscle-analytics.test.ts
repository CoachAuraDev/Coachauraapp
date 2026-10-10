// TEST DATA ONLY. Golden expectations mirror pinned GymMane's source/tests.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kExercises, type CatalogExercise } from "./catalog.ts";
import type { Client, SessionLog, SetLog } from "./models.ts";
import {
  GYM_MUSCLES, RECOVERY_HOURS, RADAR_AXES, HEAT_RAMPS, heatLevel, heatColor,
  recoveryColor, muscleTargetFor, muscleSetsOver, muscleHeatOver,
  originalMuscleAnalytics, muscleRecovery, muscleFatigue, setEffort,
  hoursUntilRecovered, radar30,
} from "./original-muscle-analytics.ts";

const now = new Date(2026, 9, 10);
const set = (kind: SetLog["kind"] = "normal", rpe: number | null = null): SetLog =>
  ({ id: "TEST-set", reps: 8, weight: 50, kind, rpe });
const session = (date: string, primary: string, n: number, id = "TEST-unknown"): SessionLog =>
  ({ id: "TEST-session", date, durationSec: 900, routineId: null, name: "TEST DATA ONLY",
    exercises: [{ id, primary, name: "TEST exercise", equipment: "Other", sets: Array.from({ length: n }, () => set()) }] });
const client = (sessions: SessionLog[] = []): Client =>
  ({ id: "TEST-client", name: "TEST DATA ONLY", sessions } as Client);
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("upstream muscle_map_test: primary gets one, catalogued secondary gets half; no heuristic involvement", () => {
  const s = session("2026-10-09", "chest", 4, "EIeI8Vf");
  s.exercises[0]!.sets.push(set("warmup"));
  const values = muscleSetsOver(client([s]), kExercises, 7, now);
  assert.equal(values.chest, 4);
  assert.equal(values.triceps, 2);
  assert.equal(values.shoulders, undefined); // Original bench catalogue: triceps ONLY.
  assert.equal(values.quads, undefined);
});
test("upstream muscle_map_test: 9-day-old work excluded from seven days but included in thirty", () => {
  const c = client([session("2026-10-01", "back", 5)]);
  assert.equal(muscleSetsOver(c, kExercises, 7, now).back, undefined);
  assert.equal(muscleSetsOver(c, kExercises, 30, now).back, 5);
});
test("upstream muscle_map_test: weekly target12, proportional period target, heat caps at one", () => {
  assert.equal(muscleTargetFor(7), 12);
  assert.equal(muscleTargetFor(28), 48);
  close(muscleTargetFor(30), 360 / 7);
  const c = client([session("2026-10-09", "quads", 6)]);
  assert.equal(muscleHeatOver(c, [], 7, now).quads, .5);
  c.sessions.push(session("2026-10-08", "quads", 30));
  assert.equal(muscleHeatOver(c, [], 7, now).quads, 1);
  close(muscleHeatOver(client([session("2026-10-09", "glutes", 12)]), [], 30, now).glutes!, 7 / 30);
});
test("exact inclusive calendar windows and original lower-bound-only future-date edge case", () => {
  const c = client([session("2026-10-04", "chest", 1), session("2026-10-03", "chest", 2),
    session("2026-09-11", "chest", 4), session("2026-09-10", "chest", 8),
    session("2026-10-11", "chest", 16)]);
  assert.equal(muscleSetsOver(c, [], 7, now).chest, 17);
  assert.equal(muscleSetsOver(c, [], 30, now).chest, 23);
  assert.equal(radar30(c, [], now).sets.chest, 7); // Between() has upper bound.
  assert.deepEqual(muscleFatigue(client([session("2026-10-11", "chest", 16)]), [], now), {});
});
test("heat thresholds and ALL original dark palette hex values match pinned Dart", () => {
  assert.deepEqual([0, .001, .2499, .25, .4999, .5, .7499, .75, 1].map(heatLevel), [0, 1, 1, 2, 2, 3, 3, 4, 4]);
  const dart = readFileSync(new URL("../../../third_party/gymmane/upstream-analytics/lib/widgets/body_map.dart", import.meta.url), "utf8");
  const ramps = dart.split("kHeatRampsDark = {")[1]!.split("};")[0]!;
  const colours = [...ramps.matchAll(/Color\(0xFF([0-9A-F]{6})\)/g)].map((m) => `#${m[1]}`);
  assert.deepEqual(Object.values(HEAT_RAMPS).flat(), colours);
  assert.equal(heatColor(.25), "#B4632C");
  assert.equal(heatColor(.5, "blue"), "#3D86C9");
  assert.equal(heatColor(.75, "green"), "#63D67F");
  assert.equal(recoveryColor(0).toUpperCase(), "#E5674C");
  assert.equal(recoveryColor(.5).toUpperCase(), "#E0B15A");
});
test("original non-warmup definition counts zero-rep sets too; no RIR weighting in workload", () => {
  const s = session("2026-10-10", "chest", 1);
  s.exercises[0]!.sets = [{ ...set("normal", 5), reps: 0 }, set("drop", 10), set("failure", 10), set("restPause"), set("warmup")];
  assert.equal(muscleSetsOver(client([s]), [], 7, now).chest, 4);
  close(muscleHeatOver(client([s]), [], 7, now).chest!, 4 / 12);
});
test("original effort formula, failure fallback and clamps", () => {
  assert.equal(setEffort(set()), 1);
  assert.equal(setEffort(set("failure")), 1.2);
  assert.equal(setEffort(set("normal", 9)), 1);
  assert.equal(setEffort(set("normal", 10)), 1.25);
  assert.equal(setEffort(set("normal", 5)), .4);
  assert.equal(setEffort(set("normal", 100)), 1.3);
});
test("source recovery constants and muscle order identical to Dart", () => {
  const dart = readFileSync(new URL("../../../third_party/gymmane/upstream-analytics/lib/state/stats_state.dart", import.meta.url), "utf8");
  const map = dart.split("_recoveryHours = {")[1]!.split("};")[0]!;
  assert.deepEqual(RECOVERY_HOURS, Object.fromEntries([...map.matchAll(/'([^']+)': (\d+)/g)].map((m) => [m[1], Number(m[2])])));
  const model = readFileSync(new URL("../../../third_party/gymmane/upstream-analytics/lib/models/exercise.dart", import.meta.url), "utf8");
  const block = model.split("kMuscles = [")[1]!.split("];")[0]!;
  assert.deepEqual(GYM_MUSCLES, [...block.matchAll(/Muscle\('([^']+)'/g)].map((m) => m[1]));
});
test("golden recovery: eight RPE9 bench sets at midnight; decay24h; 80% ready threshold", () => {
  const s = session("2026-10-10", "chest", 8, "EIeI8Vf");
  s.exercises[0]!.sets = s.exercises[0]!.sets.map((st) => ({ ...st, rpe: 9 }));
  const c = client([s]);
  const result = originalMuscleAnalytics(c, kExercises, 7, now);
  assert.equal(result.recovery.chest, 0);
  assert.equal(result.recovery.triceps, .5);
  assert.equal(result.overall, 89);
  assert.deepEqual(result.tired, ["chest", "triceps"]);
  assert.equal(hoursUntilRecovered("chest", result.fatigue), 33);
  assert.equal(hoursUntilRecovered("triceps", result.fatigue), 15);
  const later = new Date(2026, 9, 11);
  const recovery = muscleRecovery(c, kExercises, later);
  close(recovery.chest, 1 - Math.exp(-24 / 20));
  close(recovery.triceps, 1 - .5 * Math.exp(-24 / 16));
  assert.equal(hoursUntilRecovered("chest", muscleFatigue(c, kExercises, later)), 9);
});
test("source recovery eight-day cutoff and integer-minute truncation preserved", () => {
  const c = client([session("2026-10-02", "chest", 8)]);
  assert.ok(muscleFatigue(c, [], now).chest! > 0);
  assert.deepEqual(muscleFatigue(c, [], new Date(now.getTime() + 60000)), {});
  const s = session(new Date(now.getTime() + 30000).toISOString(), "chest", 8);
  assert.equal(muscleFatigue(client([s]), [], now).chest, 8);
});
test("30-day twelve-axis radar: original ordering, merges and highest-axis normalization", () => {
  const c = client([session("2026-10-01", "chest", 12), session("2026-10-02", "abdomen", 3),
    session("2026-10-03", "obliques", 3), session("2026-10-04", "back", 3),
    session("2026-10-05", "lowerback", 6)]);
  const radar = radar30(c, [], now);
  assert.equal(RADAR_AXES.length, 12);
  assert.equal(radar.sets.abdomen, 6);
  assert.equal(radar.sets.back, 9);
  assert.equal(radar.values[RADAR_AXES.indexOf("abdomen")], .5);
  assert.equal(radar.values[RADAR_AXES.indexOf("back")], .75);
  assert.deepEqual(originalMuscleAnalytics(c, [], 7, now).radar, originalMuscleAnalytics(c, [], 30, now).radar);
});
test("custom explicit mappings adapt taxonomy without guessing; unmapped adductors remain visible as a limitation", () => {
  const custom = { id: "TEST-custom", secondary: ["traps", "forearms"] } as CatalogExercise;
  const c = client([session("2026-10-10", "side-deltoids", 2, custom.id), session("2026-10-10", "adductors", 1)]);
  const result = originalMuscleAnalytics(c, [custom], 7, now);
  assert.equal(result.sets.shoulders, 2);
  assert.equal(result.sets.trapezius, 1);
  assert.equal(result.sets.forearm, 1);
  assert.deepEqual(result.unmapped, ["adductors"]);
});
test("per-client isolation, no draft input, empty-history defaults and read-only computation", () => {
  const a = client([session("2026-10-10", "chest", 6)]);
  const b = client([session("2026-10-10", "quads", 12)]);
  const before = JSON.stringify([a, b]);
  const first = originalMuscleAnalytics(a, [], 7, now), second = originalMuscleAnalytics(b, [], 30, now);
  assert.equal(first.sets.quads, undefined);
  assert.equal(second.sets.chest, undefined);
  assert.equal(JSON.stringify([a, b]), before);
  const empty = originalMuscleAnalytics(client(), [], 7, now);
  assert.deepEqual(empty.sets, {});
  assert.deepEqual(empty.behind, []);
  assert.deepEqual(empty.radar.values, Array(12).fill(0));
  assert.equal(empty.overall, 100); // Original no-fatigue default, NOT physiological evidence.
});
test("lossless body asset: every original base path, fill region and hit region preserved", () => {
  const body = JSON.parse(readFileSync(new URL("../../assets/gymmane-body.json", import.meta.url), "utf8"));
  const dart = readFileSync(new URL("../../../third_party/gymmane/upstream-analytics/lib/catalog/body_svg.dart", import.meta.url), "utf8");
  const strings = (s: string) => [...s.matchAll(/r?'([^']*)'/g)].map((m) => m[1]);
  const section = (name: string) => dart.match(new RegExp(`\\b${name}\\s*=\\s*([\\[{].*?[\\]}]);`, "s"))![1]!;
  assert.deepEqual(body.bodyBaseMain, strings(section("bodyBaseMain")));
  assert.deepEqual(body.bodyBaseLite, strings(section("bodyBaseLite")));
  for (const name of ["muscleFills", "muscleHits"]) {
    const parsed = Object.fromEntries([...section(name).matchAll(/'([^']+)':\s*\[(.*?)\]/gs)].map((m) => [m[1], strings(m[2]!)]));
    assert.deepEqual(body[name], parsed);
  }
  assert.equal(body.width, 535);
  assert.equal(body.height, 462);
  assert.equal(Object.keys(body.muscleFills).length, 14);
});
