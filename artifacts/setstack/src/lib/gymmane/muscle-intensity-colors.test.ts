// TEST DATA ONLY: presentation mapping against real workout-log calculations.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coachAuraIntensityColor, COACHAURA_INTENSITY_SCALE, coachAuraWorkloadColor, COACHAURA_WORKLOAD_LEGEND, workloadLegendForAppearance } from "./muscle-intensity-colors.ts";
import { analyzeMuscleActivity, intensityForWeeklyEquivalent } from "./muscle-activity.ts";
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

test("CoachAura workload colours respect the unchanged 3/6/10 boundaries and all six palette stops", () => {
  assert.deepEqual(COACHAURA_WORKLOAD_LEGEND.map((s) => s.color),
    ["#35353B", "#45521F", "#667F25", "#86B832", "#A5E635", "#C6FF57"]);
  assert.equal(coachAuraWorkloadColor(0, "default"), "#35353B");
  assert.equal(coachAuraWorkloadColor(Number.EPSILON, "default"), "#45521F");
  assert.equal(coachAuraWorkloadColor(2.999999, "default"), "#667F25");
  assert.equal(coachAuraWorkloadColor(3, "default"), "#86B832");
  assert.equal(coachAuraWorkloadColor(5.99999, "default"), "#86B832");
  assert.equal(coachAuraWorkloadColor(6, "default"), "#A5E635");
  assert.equal(coachAuraWorkloadColor(9.99999, "default"), "#A5E635");
  assert.equal(coachAuraWorkloadColor(10, "default"), "#C6FF57");
  assert.equal(coachAuraWorkloadColor(100, "default"), "#C6FF57");
  assert.equal(coachAuraWorkloadColor(NaN, "default"), "#35353B");
  assert.equal(coachAuraWorkloadColor(-1, "default"), "#35353B");
  assert.deepEqual([0, .001, 2.99, 3, 6, 10].map(intensityForWeeklyEquivalent),
    ["none", "low", "low", "moderate", "high", "very-high"]);
  const brightness = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))
    .reduce((sum, channel, i) => sum + channel * [.2126, .7152, .0722][i]!, 0);
  let previous = brightness(coachAuraWorkloadColor(0, "default"));
  for (let i = 1; i <= 110; i++) {
    const current = brightness(coachAuraWorkloadColor(i / 10, "default"));
    assert.ok(current >= previous);
    previous = current;
  }
});

test("CoachAura 7/30-day completed test workouts, empty and high workloads map without changing data or recovery", () => {
  const c = client([session("2026-10-11", 6), session("2026-10-02", 6)]);
  const before = JSON.stringify(c);
  const week = analyzeMuscleActivity(c, kExercises, 7, "2026-10-11");
  const month = analyzeMuscleActivity(c, kExercises, 30, "2026-10-11");
  const chest = week.muscles.find((m) => m.id === "chest")!;
  const monthChest = month.muscles.find((m) => m.id === "chest")!;
  assert.equal(chest.weeklyEquivalent, 7.5);
  assert.equal(chest.directSets, 6);
  assert.equal(monthChest.directSets, 12);
  assert.equal(monthChest.weeklyEquivalent, 3.5);
  assert.equal(coachAuraWorkloadColor(chest.weeklyEquivalent, "orange-charcoal"), "#C98C67");
  assert.equal(coachAuraWorkloadColor(monthChest.weeklyEquivalent, "orange-charcoal"), "#A96F4B");
  assert.deepEqual(week.muscles.map((m) => m.recoveryStatus), month.muscles.map((m) => m.recoveryStatus));
  const high = analyzeMuscleActivity(client([session("2026-10-11", 80)]), kExercises, 30, "2026-10-11");
  assert.equal(coachAuraWorkloadColor(high.muscles.find((m) => m.id === "chest")!.weeklyEquivalent, "orange-charcoal"), "#E8A87C");
  const empty = analyzeMuscleActivity(client([]), kExercises, 7, "2026-10-11");
  assert.ok(empty.muscles.every((m) => coachAuraWorkloadColor(m.weeklyEquivalent) === "#35353B"));
  assert.equal(JSON.stringify(c), before);
  assert.deepEqual(analyzeMuscleActivity(c, kExercises, 7, "2026-10-11"), week);
});

test("CoachAura front/back and labelled buttons share workload mapping while selection handlers remain intact", () => {
  const ui = readFileSync(new URL("../../components/muscle-map.tsx", import.meta.url), "utf8");
  assert.ok(ui.includes('SHAPES[view][id]'));
  assert.ok(ui.includes('coachAuraWorkloadColor(byId.get(id)?.weeklyEquivalent ?? 0, appearance)'));
  assert.ok(ui.includes("workloadLegendForAppearance(appearance)"));
  assert.ok(ui.includes('fill={colorOf(id)}'));
  assert.ok(ui.includes('background: colorOf(id)'));
  assert.ok(ui.includes('onClick={() => onSelect(id)}'));
  assert.ok(ui.includes('onKeyDown={keyHandler(id)}'));
  assert.ok(ui.includes('onClick={() => setView(v)}'));
  assert.ok(ui.includes('weighted sets/week'));
});

test("only the orange-peach and original lime workload palettes use the unchanged thresholds", () => {
  const orange = [0, Number.EPSILON, 2.99999, 3, 6, 10].map((value) => coachAuraWorkloadColor(value, "orange-charcoal"));
  assert.deepEqual(orange, ["#35353B", "#573A2A", "#80543A", "#A96F4B", "#C98C67", "#E8A87C"]);
  assert.equal(intensityForWeeklyEquivalent(3), "moderate");
  assert.equal(intensityForWeeklyEquivalent(6), "high");
  assert.equal(intensityForWeeklyEquivalent(10), "very-high");
  assert.equal(coachAuraWorkloadColor(10, "orange-charcoal"), "#E8A87C");
  assert.equal(coachAuraWorkloadColor(10, "default"), "#C6FF57");
  assert.deepEqual(workloadLegendForAppearance("default").map((entry) => entry.label),
    ["Inactive", "Very low", "Low", "Moderate", "High", "Very high"]);
});

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
