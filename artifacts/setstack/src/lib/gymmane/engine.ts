// Training math ported from GymMane (InlitX, GPL-3.0).
// workout.dart: Epley / RTS one-rep, volume (warm-up sets excluded).
// tools_state.dart: BMI, Mifflin–St Jeor, US Navy, plates, warm-up,
// RPE load, DOTS, Wilks, FFMI.
// fit_core.dart / stats_state.dart: streak and heat buckets.

export type Sex = "male" | "female";
export type Unit = "kg" | "lb";
export type SetKind = "normal" | "warmup" | "drop" | "failure" | "restPause";

export const SET_KINDS: SetKind[] = ["normal", "warmup", "drop", "failure", "restPause"];

export const KIND_LABEL: Record<SetKind, string> = {
  normal: "Work",
  warmup: "Warm-up",
  drop: "Drop",
  failure: "Failure",
  restPause: "Rest-pause",
};

/** GymMane DOTS seeds: full squat, bench press, deadlift. */
export const DOTS_LIFTS = ["qXTaZnJ", "EIeI8Vf", "ila4NZS"] as const;

export const LB = 2.2046226218;

const RPE_TABLE = [
  1, 0.978, 0.955, 0.939, 0.922, 0.907, 0.892, 0.878, 0.863, 0.85, 0.837, 0.824, 0.811, 0.799, 0.786,
  0.774, 0.762, 0.751, 0.739, 0.723, 0.707, 0.694, 0.68, 0.667, 0.653, 0.64, 0.626, 0.613, 0.599, 0.586,
  0.574,
];

export function setKindFrom(raw: unknown): SetKind {
  const index = typeof raw === "number" ? raw : 0;
  return SET_KINDS[Math.min(SET_KINDS.length - 1, Math.max(0, index))] ?? "normal";
}

export function rpePercent(reps: number, rpe: number | null | undefined): number | null {
  if (rpe == null || rpe < 6 || rpe > 10 || reps < 1 || reps > 12) return null;
  const index = (reps - 1) * 2 + Math.round((10 - rpe) * 2);
  return index < RPE_TABLE.length ? RPE_TABLE[index]! : null;
}

/** LoggedSet.oneRm — RTS chart when RPE is in range, otherwise Epley. */
export function oneRm(reps: number, weight: number, rpe?: number | null): number {
  if (reps <= 0 || weight <= 0) return 0;
  const pct = rpePercent(reps, rpe);
  return pct == null ? weight * (1 + reps / 30) : weight / pct;
}

export function oneRmMethod(reps: number, weight: number, rpe?: number | null): "epley" | "rts" | "none" {
  if (reps <= 0 || weight <= 0) return "none";
  return rpePercent(reps, rpe) == null ? "epley" : "rts";
}

export function countsTowardVolume(kind: SetKind): boolean {
  return kind !== "warmup";
}

export function setVolume(reps: number, weight: number, kind: SetKind): number {
  if (!countsTowardVolume(kind)) return 0;
  return reps * weight;
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function bmi(weightKg: number, heightCm: number): number {
  return round1(weightKg / (heightCm / 100) ** 2);
}

export function bmiCategory(value: number): string {
  if (value < 18.5) return "Underweight";
  if (value < 25) return "Normal";
  if (value < 30) return "Overweight";
  return "Obese";
}

export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === "male" ? base + 5 : base - 161;
}

export function tdee(sex: Sex, weightKg: number, heightCm: number, age: number, activity: number): number {
  return Math.round(bmr(sex, weightKg, heightCm, age) * activity);
}

export function macros(kcal: number): { protein: number; carbs: number; fat: number } {
  return {
    protein: Math.round((kcal * 0.3) / 4),
    carbs: Math.round((kcal * 0.4) / 4),
    fat: Math.round((kcal * 0.3) / 9),
  };
}

export function activityLabel(factor: number): string {
  if (factor === 1.2) return "Sedentary";
  if (factor === 1.375) return "Light";
  if (factor === 1.725) return "Active";
  return "Moderate";
}

export const ACTIVITIES = [
  { factor: 1.2, label: "Sedentary" },
  { factor: 1.375, label: "Light" },
  { factor: 1.55, label: "Moderate" },
  { factor: 1.725, label: "Active" },
] as const;

export function navyBodyFat(
  sex: Sex,
  heightCm: number,
  neckCm: number,
  waistCm: number,
  hipCm = 0,
): number {
  let value: number;
  if (sex === "male") {
    const girth = Math.max(1, waistCm - neckCm);
    value = 495 / (1.0324 - 0.19077 * Math.log10(girth) + 0.15456 * Math.log10(heightCm)) - 450;
  } else {
    const girth = Math.max(1, waistCm + hipCm - neckCm);
    value = 495 / (1.29579 - 0.35004 * Math.log10(girth) + 0.221 * Math.log10(heightCm)) - 450;
  }
  return round1(Math.max(3, Math.min(50, value)));
}

export function ffmi(heightCm: number, weightKg: number, bodyFatPct: number): number {
  const lean = weightKg * (1 - bodyFatPct / 100);
  const metres = heightCm / 100;
  return round1(lean / (metres * metres) + 6.1 * (1.8 - metres));
}

export function ffmiLevel(score: number, sex: Sex): number {
  const adjusted = score + (sex === "male" ? 0 : 3);
  if (adjusted < 18) return 0;
  if (adjusted < 20) return 1;
  if (adjusted < 22) return 2;
  if (adjusted < 25) return 3;
  return 4;
}

export const FFMI_LABELS = ["Below average", "Average", "Above average", "Muscular", "Exceptional"];

function poly(coefs: readonly number[], x: number): number {
  return coefs.reduce((sum, coef, index) => sum + coef * x ** index, 0);
}

export function dotsScore(sex: Sex, bodyKg: number, totalKg: number): number {
  const male = sex === "male";
  const body = clamp(bodyKg, 40, male ? 210 : 150);
  const coefs = male
    ? [-307.75076, 24.0900756, -0.1918759221, 0.0007391293, -0.000001093]
    : [-57.96288, 13.6175032, -0.1126655495, 0.0005158568, -0.0000010706];
  return round1((totalKg * 500) / poly(coefs, body));
}

export function wilksScore(sex: Sex, bodyKg: number, totalKg: number): number {
  const male = sex === "male";
  const body = clamp(bodyKg, male ? 40 : 26.51, male ? 201.9 : 154.53);
  const coefs = male
    ? [-216.0475144, 16.2606339, -0.002388645, -0.00113732, 7.01863e-6, -1.291e-8]
    : [594.31747775582, -27.23842536447, 0.82112226871, -0.00930733913, 4.731582e-5, -9.054e-8];
  return round1((totalKg * 500) / poly(coefs, body));
}

export function strengthLevel(score: number): number {
  if (score < 250) return 0;
  if (score < 325) return 1;
  if (score < 400) return 2;
  if (score < 475) return 3;
  return 4;
}

export const STRENGTH_LABELS = ["Building", "Solid", "Strong", "Advanced", "Elite"];

export function plateSteps(unit: Unit): number[] {
  return unit === "lb" ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25];
}

export function barWeight(unit: Unit): number {
  return unit === "lb" ? 45 : 20;
}

export function platesPerSide(
  displayTarget: number,
  displayBar: number,
  steps = plateSteps("kg"),
): { weight: number; count: number }[] {
  let perSide = Math.max(0, (displayTarget - displayBar) / 2);
  const out: { weight: number; count: number }[] = [];
  for (const plate of steps) {
    const count = Math.floor(perSide / plate + 1e-6);
    if (count > 0) {
      out.push({ weight: plate, count });
      perSide = round1(perSide - count * plate);
    }
  }
  return out;
}

export function warmupSets(
  displayTarget: number,
  step: number,
): { pct: string; reps: number; weight: number }[] {
  const spec: [number, number][] = [
    [40, 10],
    [60, 5],
    [80, 3],
    [90, 1],
  ];
  return spec.map(([pct, reps]) => ({
    pct: `${pct}%`,
    reps,
    weight: roundTo((displayTarget * pct) / 100, step),
  }));
}

/** tools_state rpeResult: round the estimated 1RM to 0.1, then snap the target load. */
export function rpeLoad(
  weight: number,
  reps: number,
  rpe: number,
  targetReps: number,
  targetRpe: number,
  step = 2.5,
): { oneRm: number; load: number } {
  const share = (repCount: number, effort: number) => rpePercent(repCount, effort) ?? 1 / (1 + repCount / 30);
  const estimated = round1(weight / share(reps, rpe));
  return { oneRm: estimated, load: roundTo(estimated * share(targetReps, targetRpe), step) };
}

export function toDisplay(kg: number, unit: Unit): number {
  return unit === "lb" ? kg * LB : kg;
}

export function fromDisplay(value: number, unit: Unit): number {
  return unit === "lb" ? value / LB : value;
}

export function formatLoad(kg: number, unit: Unit): string {
  const value = round1(toDisplay(kg, unit));
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return `${text} ${unit}`;
}

export function formatInt(kg: number, unit: Unit): string {
  return `${Math.round(toDisplay(kg, unit)).toLocaleString("en-US")} ${unit}`;
}

export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function shiftIso(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, (d ?? 1) + days)).toISOString().slice(0, 10);
}

export function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  const js = new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).getUTCDay();
  return js === 0 ? 7 : js;
}

export function weekStart(iso: string): string {
  return shiftIso(iso, -(isoWeekday(iso) - 1));
}

export function daysBetween(fromIso: string, toIso: string): number {
  const [fy, fm, fd] = fromIso.split("-").map(Number);
  const [ty, tm, td] = toIso.split("-").map(Number);
  const a = Date.UTC(fy!, (fm ?? 1) - 1, fd ?? 1);
  const b = Date.UTC(ty!, (tm ?? 1) - 1, td ?? 1);
  return Math.round((b - a) / 86400000);
}

export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export function relativeDay(iso: string, today: string): string {
  const gap = daysBetween(iso, today);
  if (gap === 0) return "Today";
  if (gap === 1) return "Yesterday";
  if (gap > 1 && gap < 7) return `${gap} days ago`;
  return shortDate(iso);
}

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

/** stats_state currentStreak. Planned weekdays are training days; other days are rest. */
export function currentStreak(sessionDates: string[], planWeekdays: number[], today: string): number {
  const days = new Set(sessionDates);
  if (days.size === 0) return 0;
  const first = [...days].sort()[0]!;
  const rest = (iso: string) => planWeekdays.length > 0 && !planWeekdays.includes(isoWeekday(iso));
  let cursor = today;
  if (!days.has(cursor)) cursor = shiftIso(cursor, -1);
  let count = 0;
  while (cursor >= first) {
    if (days.has(cursor)) count += 1;
    else if (!rest(cursor)) break;
    cursor = shiftIso(cursor, -1);
  }
  return count;
}

export function heatLevel(fraction: number): number {
  if (fraction <= 0) return 0;
  if (fraction < 0.25) return 1;
  if (fraction < 0.5) return 2;
  if (fraction < 0.75) return 3;
  return 4;
}

export function clock(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function uid(): string {
  return crypto.randomUUID();
}
