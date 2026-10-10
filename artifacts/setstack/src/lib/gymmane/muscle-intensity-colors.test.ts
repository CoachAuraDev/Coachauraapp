// TEST DATA ONLY: presentation mapping against real workout-log calculations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coachAuraIntensityColor, COACHAURA_INTENSITY_SCALE } from "./muscle-intensity-colors.ts";
import { heatLevel, originalMuscleAnalytics, recoveryColor } from "./original-muscle-analytics.ts";
import { kExercises } from "./catalog.ts";
import type { Client, SessionLog } from "./models.ts";

const now = new Date(2026, 9, 11);
function session(date: string, sets: number): SessionLog {
  return { id: "TEST-history", date, durationSec: 900, name: "TEST DATA ONLY",
    routineId: null, exercises: [{ id: "EIeI8Vf", name: "Barbell Bench Press", primary: "chest",
      equipment: "Barbell", sets: Array.from({ length: sets }, (_, i) => ({
        id: `TEST-set-${i}`, reps: 8, weight: 50, kind: "normal", rpe: 9,
      })) }] };
}
const client = (sessions: SessionLog[]): Client => ({ id: "TEST-client", name: "TEST DATA ONLY", sessions } as Client);

test("all six exact CoachAura colour anchors and unchanged source thresholds", () => {
  assert.deepEqual(COACHAURA_INTENSITY_SCALE.map((s) => s.color),
    ["#35353B", "#45521F", "#667F25", "#86B832", "#A5E635", "#C6FF57"]);
  assert.equal(coachAuraIntensityColor(0), "#35353B");
  assert.equal(coachAuraIntensityColor(Number.EPSILON), "#45521F");
  assert.equal(coachAuraIntensityColor(.25), "#667F25");
  assert.equal(coachAuraIntensityColor(.5), "#86B832");
  assert.equal(coachAuraIntensityColor(.75), "#A5E635");
  assert.equal(coachAuraIntensityColor(1), "#C6FF57");
  assert.equal(coachAuraIntensityColor(10), "#C6FF57");
  assert.equal(coachAuraIntensityColor(-1), "#35353B");
  assert.equal(coachAuraIntensityColor(NaN), "#35353B");
  assert.deepEqual([0, .001, .25, .5, .75, 1].map(heatLevel), [0, 1, 2, 3, 4, 4]);
});
test("within unchanged bands, luminance increases monotonically and inactive remains distinct", () => {
  function luminance(hex: string) {
    const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((c) => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4);
    return rgb[0]! * .2126 + rgb[1]! * .7152 + rgb[2]! * .0722;
  }
  let previous = luminance(coachAuraIntensityColor(0));
  for (let i = 1; i <= 100; i++) {
    const current = luminance(coachAuraIntensityColor(i / 100));
    assert.ok(current >= previous);
    previous = current;
  }
  assert.notEqual(coachAuraIntensityColor(0), coachAuraIntensityColor(.001));
});
test("7/30-day real set values, substantial and empty history, and recovery outputs remain unmodified", () => {
  const c = client([session("2026-10-11", 6), session("2026-10-02", 6)]);
  const before = JSON.stringify(c);
  const week = originalMuscleAnalytics(c, kExercises, 7, now);
  const month = originalMuscleAnalytics(c, kExercises, 30, now);
  assert.equal(week.sets.chest, 6);
  assert.equal(week.heat.chest, .5);
  assert.equal(coachAuraIntensityColor(week.heat.chest!), "#86B832");
  assert.equal(week.heat.triceps, .25);
  assert.equal(coachAuraIntensityColor(week.heat.triceps!), "#667F25");
  assert.equal(month.sets.chest, 12);
  assert.equal(month.heat.chest, 7 / 30);
  assert.notEqual(coachAuraIntensityColor(month.heat.chest!), coachAuraIntensityColor(week.heat.chest!));
  assert.deepEqual(week.recovery, month.recovery);
  assert.deepEqual(week.radar, month.radar);
  const high = originalMuscleAnalytics(client([session("2026-10-11", 80)]), kExercises, 30, now);
  assert.equal(coachAuraIntensityColor(high.heat.chest!), "#C6FF57");
  const empty = originalMuscleAnalytics(client([]), kExercises, 7, now);
  assert.equal(coachAuraIntensityColor(empty.heat.chest ?? 0), "#35353B");
  assert.equal(recoveryColor(0).toUpperCase(), "#E5674C");
  assert.equal(recoveryColor(.5).toUpperCase(), "#E0B15A");
  assert.equal(JSON.stringify(c), before);
  assert.deepEqual(originalMuscleAnalytics(c, kExercises, 7, now), week);
});
test("both body views share one colour mapper; SVG geometry and selection handlers are untouched", () => {
  const ui = readFileSync(new URL("../../components/gymmane-body-map.tsx", import.meta.url), "utf8");
  assert.ok(ui.includes('BODY.muscleFills[id]!.map'));
  assert.ok(ui.includes('coachAuraIntensityColor(intensity[id] ?? 0)'));
  assert.ok(ui.includes('if (el.isPointInFill(p)) { onTap(id); return; }'));
  assert.ok(ui.includes('color={(id) => recoveryColor(recovery[id] ?? 1)}'));
});
