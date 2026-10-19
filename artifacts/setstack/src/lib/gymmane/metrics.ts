import { exerciseById } from "./match.ts";
import type { Client, ExerciseLog, Routine, SessionLog, SetLog } from "./models.ts";
import {
  DOTS_LIFTS,
  countsTowardVolume,
  currentStreak,
  daysBetween,
  dotsScore,
  ffmi,
  ffmiLevel,
  heatLevel,
  isoWeekday,
  navyBodyFat,
  oneRm,
  oneRmMethod,
  setVolume,
  shiftIso,
  tdee,
  todayIso,
  weekStart,
  wilksScore,
  type Unit,
} from "./engine.ts";

export function workingSets(sets: SetLog[]): SetLog[] {
  return sets.filter((set) => countsTowardVolume(set.kind) && set.reps > 0);
}

export function exerciseVolume(exercise: ExerciseLog): number {
  return exercise.sets.reduce((sum, set) => sum + setVolume(set.reps, set.weight, set.kind), 0);
}

export function sessionVolume(session: SessionLog): number {
  return session.exercises.reduce((sum, exercise) => sum + exerciseVolume(exercise), 0);
}

export function bestSetOneRm(sets: SetLog[]): number {
  return workingSets(sets).reduce((best, set) => Math.max(best, oneRm(set.reps, set.weight, set.rpe)), 0);
}

export function planWeekdays(client: Client): number[] {
  return Object.keys(client.weeklyPlan)
    .map(Number)
    .filter((day) => day >= 1 && day <= 7);
}

export function clientSummary(client: Client, today = todayIso()) {
  const dates = client.sessions.map((session) => session.date);
  const lastDate = dates.length ? [...dates].sort().at(-1)! : null;
  const daysSince = lastDate ? daysBetween(lastDate, today) : null;
  const start = weekStart(today);
  const end = shiftIso(start, 6);
  const weekSessions = client.sessions.filter((session) => session.date >= start && session.date <= end);
  const weekDays = new Set(weekSessions.map((session) => session.date));
  const status: "new" | "on-floor" | "due" | "overdue" =
    daysSince == null ? "new" : daysSince >= 8 ? "overdue" : daysSince >= 4 ? "due" : "on-floor";
  let top: { id: string; name: string; e1rm: number } | null = null;
  for (const session of client.sessions) {
    for (const exercise of session.exercises) {
      const e1rm = bestSetOneRm(exercise.sets);
      if (e1rm > 0 && (!top || e1rm > top.e1rm)) top = { id: exercise.id, name: exercise.name, e1rm };
    }
  }
  return {
    lastDate,
    daysSince,
    status,
    weekDone: weekDays.size,
    weekGoal: client.weeklyGoal,
    weekVolume: weekSessions.reduce((sum, session) => sum + sessionVolume(session), 0),
    streak: currentStreak(dates, planWeekdays(client), today),
    top,
  };
}

export function routineForWeekday(client: Client, iso: string): Routine | null {
  const id = client.weeklyPlan[String(isoWeekday(iso))];
  if (!id) return null;
  return client.routines.find((routine) => routine.id === id) ?? null;
}

export function lastPerformance(client: Client, exerciseId: string): { date: string; sets: SetLog[] } | null {
  const sessions = [...client.sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const session of sessions) {
    const exercise = session.exercises.find((item) => item.id === exerciseId);
    if (exercise && exercise.sets.length) return { date: session.date, sets: exercise.sets };
  }
  return null;
}

export function e1rmSeries(client: Client, exerciseId: string): { date: string; e1rm: number }[] {
  return [...client.sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((session) => {
      const exercise = session.exercises.find((item) => item.id === exerciseId);
      if (!exercise) return [];
      const e1rm = bestSetOneRm(exercise.sets);
      return e1rm > 0 ? [{ date: session.date, e1rm }] : [];
    });
}

export function weeklyVolumeSeries(client: Client, today = todayIso(), weeks = 8) {
  const startThis = weekStart(today);
  const points = [];
  for (let index = weeks - 1; index >= 0; index -= 1) {
    const start = shiftIso(startThis, -7 * index);
    const end = shiftIso(start, 6);
    const volume = client.sessions
      .filter((session) => session.date >= start && session.date <= end)
      .reduce((sum, session) => sum + sessionVolume(session), 0);
    points.push({ start, volume });
  }
  return points;
}

export function muscleSplit(client: Client, today = todayIso(), days = 30) {
  const from = shiftIso(today, -(days - 1));
  const totals = new Map<string, number>();
  for (const session of client.sessions) {
    if (session.date < from || session.date > today) continue;
    for (const exercise of session.exercises) {
      totals.set(exercise.primary, (totals.get(exercise.primary) ?? 0) + exerciseVolume(exercise));
    }
  }
  const sum = [...totals.values()].reduce((a, b) => a + b, 0) || 1;
  return [...totals.entries()]
    .map(([name, volume]) => ({ name, volume, pct: Math.round((volume / sum) * 100) }))
    .sort((a, b) => b.volume - a.volume);
}

export function personalRecords(client: Pick<Client, "sessions">) {
  const best = new Map<string, { name: string; e1rm: number; weight: number; reps: number; date: string; rpe: number | null }>();
  for (const session of client.sessions) {
    for (const exercise of session.exercises) {
      for (const set of workingSets(exercise.sets)) {
        const e1rm = oneRm(set.reps, set.weight, set.rpe);
        const prev = best.get(exercise.id);
        if (!prev || e1rm > prev.e1rm) {
          best.set(exercise.id, {
            name: exercise.name,
            e1rm,
            weight: set.weight,
            reps: set.reps,
            date: session.date,
            rpe: set.rpe,
          });
        }
      }
    }
  }
  return [...best.entries()]
    .map(([id, record]) => ({ id, ...record, method: oneRmMethod(record.reps, record.weight, record.rpe) }))
    .sort((a, b) => b.e1rm - a.e1rm);
}

export function prsThisWeek(client: Client, today = todayIso()): number {
  const start = weekStart(today);
  return personalRecords(client).filter((record) => record.date >= start && record.date <= shiftIso(start, 6)).length;
}

export function heatmap(client: Client, today = todayIso(), days = 84) {
  const cells = [];
  let max = 0;
  for (let index = days - 1; index >= 0; index -= 1) {
    const date = shiftIso(today, -index);
    const volume = client.sessions
      .filter((session) => session.date === date)
      .reduce((sum, session) => sum + sessionVolume(session), 0);
    if (volume > max) max = volume;
    cells.push({ date, volume });
  }
  return cells.map((cell) => ({ ...cell, level: heatLevel(max === 0 ? 0 : cell.volume / max) }));
}

export function bodyReadout(client: Client) {
  const calories = tdee(client.sex, client.weightKg, client.heightCm, client.age, client.activity);
  const canFat =
    client.neckCm != null &&
    client.waistCm != null &&
    (client.sex === "male" || client.hipCm != null);
  const fat = canFat
    ? navyBodyFat(client.sex, client.heightCm, client.neckCm!, client.waistCm!, client.hipCm ?? 0)
    : null;
  const ffmiScore = fat == null ? null : ffmi(client.heightCm, client.weightKg, fat);
  return {
    calories,
    fat,
    ffmiScore,
    ffmiBand: ffmiScore == null ? null : ffmiLevel(ffmiScore, client.sex),
  };
}

export function strengthTotals(client: Client) {
  const best = new Map(personalRecords(client).map((record) => [record.id, record.e1rm]));
  const [squat, bench, dead] = DOTS_LIFTS.map((id) => best.get(id) ?? 0);
  const total = squat + bench + dead;
  if (squat <= 0 || bench <= 0 || dead <= 0) return { squat, bench, dead, total, dots: null, wilks: null };
  return {
    squat,
    bench,
    dead,
    total,
    dots: dotsScore(client.sex, client.weightKg, total),
    wilks: wilksScore(client.sex, client.weightKg, total),
  };
}

export function exerciseTitle(id: string, customName?: string): string {
  return customName || exerciseById(id)?.name || "Exercise";
}

export function suggestSet(
  client: Client,
  exerciseId: string,
  draftSets: SetLog[],
  unit: Unit,
): { reps: number; weightKg: number; rpe: number | null } {
  const drafted = [...draftSets].reverse().find((set) => countsTowardVolume(set.kind) && set.reps > 0);
  if (drafted) return { reps: drafted.reps, weightKg: drafted.weight, rpe: drafted.rpe };
  const previous = lastPerformance(client, exerciseId);
  const last = previous ? [...workingSets(previous.sets)].at(-1) : undefined;
  if (last) return { reps: last.reps, weightKg: last.weight, rpe: last.rpe };
  const info = exerciseById(exerciseId);
  const equipment = info?.equipment ?? "Other";
  const weightKg = equipment === "Bodyweight" ? 0 : equipment === "Dumbbell" || equipment === "Kettlebell" ? 8 : 20;
  void unit;
  return { reps: equipment === "Bodyweight" ? 8 : 5, weightKg, rpe: null };
}

export const MUSCLE_LABEL: Record<string, string> = {
  abdomen: "Abs",
  back: "Back",
  biceps: "Biceps",
  calves: "Calves",
  chest: "Chest",
  forearm: "Forearms",
  glutes: "Glutes",
  hamstrings: "Hamstrings",
  lowerback: "Lower back",
  obliques: "Obliques",
  quads: "Quads",
  shoulders: "Shoulders",
  trapezius: "Traps",
  triceps: "Triceps",
};
