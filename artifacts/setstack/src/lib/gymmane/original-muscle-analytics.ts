// SPDX-License-Identifier: GPL-3.0-only
// Port of InlitX/GymMane stats_state.dart, fit_core.dart, body_map.dart and
// muscle_radar.dart. Copyright (C) InlitX and contributors.
// Immutable source: third_party/gymmane/upstream-analytics; see parity documentation.
import type { CatalogExercise } from "./catalog.ts";
import type { Client, SessionLog, SetLog } from "./models.ts";

export const GYM_MUSCLES = [
  "chest", "shoulders", "biceps", "abdomen", "obliques", "quads", "forearm",
  "trapezius", "back", "lowerback", "triceps", "glutes", "hamstrings", "calves",
] as const;
export type GymMuscle = typeof GYM_MUSCLES[number];
export const GYM_LABELS: Record<GymMuscle, string> = {
  chest: "Chest", back: "Back", lowerback: "Lower back", shoulders: "Shoulders",
  trapezius: "Traps", biceps: "Biceps", triceps: "Triceps", forearm: "Forearms",
  abdomen: "Abs", obliques: "Obliques", quads: "Quads", hamstrings: "Hamstrings",
  glutes: "Glutes", calves: "Calves",
};
export const RADAR_AXES = ["chest", "shoulders", "trapezius", "back", "triceps",
  "biceps", "forearm", "abdomen", "quads", "calves", "hamstrings", "glutes"] as const;
export const RECOVERY_HOURS: Record<GymMuscle, number> = {
  chest: 60, back: 60, lowerback: 72, quads: 72, hamstrings: 72, glutes: 72,
  shoulders: 48, trapezius: 48, biceps: 48, triceps: 48, forearm: 36,
  calves: 36, abdomen: 36, obliques: 36,
};
export const HEAT_RAMPS = {
  ember: ["#7A4028", "#B4632C", "#E38B3A", "#FFC168"],
  green: ["#1B4B2C", "#2C7A44", "#3FA95C", "#63D67F"],
  blue: ["#1E3A5C", "#2C5E96", "#3D86C9", "#6EB4F0"],
  mono: ["#3A3A3A", "#5E5E5E", "#8C8C8C", "#D8D8D8"],
} as const;
export type HeatTone = keyof typeof HEAT_RAMPS;
// Theme-dependent inputs to the original Color.lerp expressions.
export const GYM_COLORS = {
  raised: "#222228", secondary: "#A1A1AA", tertiary: "#A1A1AA",
  danger: "#E5674C", warn: "#E0B15A", sage: "#8FA377",
};
const aliases: Record<string, string> = {
  "front-deltoids": "shoulders", "side-deltoids": "shoulders", "rear-deltoids": "shoulders",
  "upper-back": "back", lats: "back", traps: "trapezius", "lower-back": "lowerback",
  forearms: "forearm", abs: "abdomen", quadriceps: "quads",
};
export const gymMuscleId = (id: string) => aliases[id] ?? id;
const clamp = (n: number, low = 0, high = 1) => Math.min(high, Math.max(low, n));
export const muscleTargetFor = (days: number) => 12 * days / 7;
export function heatLevel(value: number) {
  return value <= 0 ? 0 : value < .25 ? 1 : value < .5 ? 2 : value < .75 ? 3 : 4;
}
export function lerpColor(a: string, b: string, amount: number) {
  const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  return "#" + [1, 3, 5].map((i) => Math.round(channel(a, i) + (channel(b, i) - channel(a, i)) * clamp(amount)).toString(16).padStart(2, "0")).join("");
}
export const idleMuscleColor = () => lerpColor(GYM_COLORS.raised, GYM_COLORS.secondary, .32);
export function heatColor(value: number, tone: HeatTone = "ember") {
  const level = heatLevel(value);
  return level === 0 ? idleMuscleColor() : HEAT_RAMPS[tone][level - 1]!;
}
export function recoveryColor(value: number) {
  const v = clamp(value), fresh = lerpColor(idleMuscleColor(), GYM_COLORS.sage, .62);
  return v < .5 ? lerpColor(GYM_COLORS.danger, GYM_COLORS.warn, v / .5)
    : lerpColor(GYM_COLORS.warn, fresh, (v - .5) / .5);
}
function loggedAt(session: SessionLog): Date | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(session.date)) {
    const [y, m, d] = session.date.split("-").map(Number);
    const date = new Date(y!, m! - 1, d!);
    return date.getFullYear() === y && date.getMonth() === m! - 1 && date.getDate() === d ? date : null;
  }
  const date = new Date(session.date);
  return Number.isFinite(date.getTime()) ? date : null;
}
const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const fromDays = (at: Date, n: number) => new Date(at.getFullYear(), at.getMonth(), at.getDate() - (n - 1));
// Upstream LoggedSet.counts excludes warm-ups ONLY; do not reuse the CoachAura
// workingSets helper, which also requires positive reps and has different semantics.
export const gymWorkingSets = (sets: SetLog[]) => sets.filter((s) => s && s.kind !== "warmup");
export function setEffort(set: SetLog) {
  if (set.rpe == null || !Number.isFinite(set.rpe)) return set.kind === "failure" ? 1.2 : 1;
  return clamp((set.rpe - 5) / 4, .4, 1.3);
}
function contributions(client: Client, library: CatalogExercise[], visit: (date: Date, muscle: string, share: number, sets: SetLog[]) => void) {
  const catalogue = new Map(library.map((e) => [e.id, e]));
  for (const session of client.sessions ?? []) {
    const at = loggedAt(session);
    if (!at) continue;
    for (const exercise of session.exercises ?? []) {
      const sets = gymWorkingSets(exercise.sets ?? []);
      if (!sets.length) continue;
      visit(at, gymMuscleId(exercise.primary), 1, sets);
      for (const secondary of catalogue.get(exercise.id)?.secondary ?? [])
        visit(at, gymMuscleId(secondary), .5, sets);
    }
  }
}
export function muscleSetsBetween(client: Client, library: CatalogExercise[], from: Date, to: Date) {
  const result: Record<string, number> = {};
  contributions(client, library, (at, muscle, share, sets) => {
    if (day(at) < day(from) || day(at) > day(to)) return;
    result[muscle] = (result[muscle] ?? 0) + sets.length * share;
  });
  return result;
}
export function muscleSetsOver(client: Client, library: CatalogExercise[], days: 7 | 30, now = new Date()) {
  const result: Record<string, number> = {};
  const start = day(fromDays(now, days));
  contributions(client, library, (at, muscle, share, sets) => {
    // Preserve the upstream lower-bound-only window, including its future-date edge case.
    if (day(at) < start) return;
    result[muscle] = (result[muscle] ?? 0) + sets.length * share;
  });
  return result;
}
export function muscleHeatOver(client: Client, library: CatalogExercise[], days: 7 | 30, now = new Date()) {
  return Object.fromEntries(Object.entries(muscleSetsOver(client, library, days, now))
    .map(([id, sets]) => [id, clamp(sets / muscleTargetFor(days))]));
}
export function muscleFatigue(client: Client, library: CatalogExercise[], now = new Date()) {
  const result: Record<string, number> = {};
  contributions(client, library, (at, muscle, share, sets) => {
    // Dart difference.inMinutes truncates fractional minutes toward zero.
    const hours = Math.trunc((now.getTime() - at.getTime()) / 60000) / 60;
    if (hours < 0 || hours > 24 * 8) return;
    const tau = (RECOVERY_HOURS[muscle as GymMuscle] ?? 48) / 3;
    const effort = sets.reduce((sum, set) => sum + setEffort(set), 0);
    result[muscle] = (result[muscle] ?? 0) + effort * share * Math.exp(-hours / tau);
  });
  return result;
}
export function muscleRecovery(client: Client, library: CatalogExercise[], now = new Date()) {
  const fatigue = muscleFatigue(client, library, now);
  return Object.fromEntries(GYM_MUSCLES.map((id) => [id, clamp(1 - (fatigue[id] ?? 0) / 8)])) as Record<GymMuscle, number>;
}
export function hoursUntilRecovered(muscle: string, fatigue: Record<string, number>) {
  const value = fatigue[muscle] ?? 0;
  return value <= 1.6 ? null : Math.ceil((RECOVERY_HOURS[muscle as GymMuscle] ?? 48) / 3 * Math.log(value / 1.6));
}
export function radar30(client: Client, library: CatalogExercise[], now = new Date()) {
  const raw = muscleSetsBetween(client, library, fromDays(now, 30), new Date(now.getTime() + 60000));
  const merged: Partial<Record<string, string>> = { abdomen: "obliques", back: "lowerback" };
  const sets = Object.fromEntries(RADAR_AXES.map((id) => [id, (raw[id] ?? 0) + (raw[merged[id] ?? ""] ?? 0)])) as Record<typeof RADAR_AXES[number], number>;
  const top = Math.max(0, ...Object.values(sets));
  return { sets, top, values: RADAR_AXES.map((id) => top > 0 ? sets[id] / top : 0),
    behind: [...RADAR_AXES].sort((a, b) => sets[a] - sets[b]).filter((id) => top > 0 && sets[id] < top * .5).slice(0, 3) };
}
export function originalMuscleAnalytics(client: Client, library: CatalogExercise[], days: 7 | 30, now = new Date()) {
  const sets = muscleSetsOver(client, library, days, now);
  const heat = muscleHeatOver(client, library, days, now);
  const fatigue = muscleFatigue(client, library, now);
  const recovery = muscleRecovery(client, library, now);
  return { sets, heat, fatigue, recovery, radar: radar30(client, library, now),
    target: muscleTargetFor(days),
    overall: Math.round(GYM_MUSCLES.reduce((sum, id) => sum + recovery[id], 0) / GYM_MUSCLES.length * 100),
    tired: GYM_MUSCLES.filter((id) => recovery[id] < .8).sort((a, b) => recovery[a] - recovery[b]),
    behind: Object.keys(sets).length ? [...GYM_MUSCLES].filter((id) => (sets[id] ?? 0) < muscleTargetFor(days) / 3)
      .sort((a, b) => (sets[a] ?? 0) - (sets[b] ?? 0)).slice(0, 3) : [],
    unmapped: Object.keys(sets).filter((id) => !GYM_MUSCLES.includes(id as GymMuscle)),
    dateOnly: client.sessions.some((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date)),
  };
}
