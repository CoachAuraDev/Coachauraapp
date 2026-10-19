import type { CatalogExercise } from "./catalog.ts";
import { isValidCalendarDate } from "./calendar-date.ts";
import {
  oneRm,
  setVolume,
  shiftIso,
  weekStart,
  type Unit,
} from "./engine.ts";
import { bestSetOneRm, sessionVolume, workingSets } from "./metrics.ts";
import {
  effortFactorFromRpe,
  MUSCLE_GROUPS,
  resolveLoggedExerciseMuscles,
  type MuscleGroup,
} from "./muscle-activity.ts";
import type { ExerciseLog, SessionLog, SetLog, WorkoutOwner } from "./models.ts";

export const INDIVIDUAL_RANGES = [7, 30, 90, 365] as const;
export type IndividualRange = (typeof INDIVIDUAL_RANGES)[number];
export type TrendFilter =
  | { kind: "all" }
  | { kind: "exercise"; exerciseId: string }
  | { kind: "muscle"; muscleId: MuscleGroup };
export type TrendMetric = "sets" | "volume";

export type IndividualSession = {
  session: SessionLog;
  workingSetCount: number;
  volumeKg: number;
};

export type IndividualOverview = {
  from: string;
  to: string;
  workouts: number;
  workingSets: number;
  volumeKg: number;
  recordsAchieved: number;
  workoutsThisWeek: number;
  activeWeeksLastFour: number;
};

export type StrengthOption = { id: string; name: string; lastLogged: string };
export type StrengthPoint = { date: string; e1rm: number };
export type PersonalRecordEvent = {
  exerciseId: string;
  exerciseName: string;
  date: string;
  weightKg: number;
  reps: number;
  e1rmKg: number;
};

export type TrendPoint = {
  start: string;
  label: string;
  workouts: number;
  workingSets: number;
  effectiveSets: number;
  volumeKg: number;
};

function dateSessions(owner: WorkoutOwner, today: string): IndividualSession[] {
  const seen = new Set<string>();
  return owner.sessions
    .filter((session) => {
      if (!isValidCalendarDate(session.date) || session.date > today || seen.has(session.id)) return false;
      seen.add(session.id);
      return true;
    })
    .map((session) => ({
      session,
      workingSetCount: session.exercises.reduce((count, exercise) => count + workingSets(exercise.sets).length, 0),
      volumeKg: sessionVolume(session),
    }))
    .filter((item) => item.workingSetCount > 0)
    .sort((a, b) => a.session.date.localeCompare(b.session.date) || a.session.id.localeCompare(b.session.id));
}

function rangeStart(today: string, days: IndividualRange): string {
  return shiftIso(today, -(days - 1));
}

export function getIndividualOverview(
  owner: WorkoutOwner,
  days: IndividualRange,
  today: string,
): IndividualOverview {
  const from = rangeStart(today, days);
  const sessions = dateSessions(owner, today).filter(({ session }) => session.date >= from);
  const currentWeek = weekStart(today);
  const recentFourWeekStart = shiftIso(currentWeek, -21);
  const recentWeeks = new Set(
    dateSessions(owner, today)
      .map(({ session }) => session.date)
      .filter((date) => date >= recentFourWeekStart && date <= today)
      .map(weekStart),
  );
  return {
    from,
    to: today,
    workouts: sessions.length,
    workingSets: sessions.reduce((sum, item) => sum + item.workingSetCount, 0),
    volumeKg: sessions.reduce((sum, item) => sum + item.volumeKg, 0),
    recordsAchieved: getPersonalRecordEvents(owner, today).filter((event) => event.date >= from).length,
    workoutsThisWeek: dateSessions(owner, today).filter(({ session }) => session.date >= currentWeek).length,
    activeWeeksLastFour: recentWeeks.size,
  };
}

export function getStrengthOptions(owner: WorkoutOwner, today: string): StrengthOption[] {
  const options = new Map<string, StrengthOption>();
  for (const { session } of dateSessions(owner, today)) {
    for (const exercise of session.exercises) {
      if (bestSetOneRm(exercise.sets) <= 0) continue;
      const current = options.get(exercise.id);
      if (!current || current.lastLogged < session.date) {
        options.set(exercise.id, { id: exercise.id, name: exercise.name, lastLogged: session.date });
      }
    }
  }
  return [...options.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getStrengthSeries(
  owner: WorkoutOwner,
  exerciseId: string,
  days: IndividualRange,
  today: string,
): StrengthPoint[] {
  const from = rangeStart(today, days);
  return dateSessions(owner, today).flatMap(({ session }) => {
    if (session.date < from) return [];
    const exercise = session.exercises.find((item) => item.id === exerciseId);
    if (!exercise) return [];
    const e1rm = bestSetOneRm(exercise.sets);
    return e1rm > 0 ? [{ date: session.date, e1rm }] : [];
  });
}

export function getPersonalRecordEvents(owner: WorkoutOwner, today: string): PersonalRecordEvent[] {
  const bestByExercise = new Map<string, number>();
  const events: PersonalRecordEvent[] = [];
  for (const { session } of dateSessions(owner, today)) {
    for (const exercise of session.exercises) {
      let sessionBest: SetLog | undefined;
      let sessionBestE1rm = 0;
      for (const set of workingSets(exercise.sets)) {
        const estimate = oneRm(set.reps, set.weight, set.rpe);
        if (estimate > sessionBestE1rm) {
          sessionBest = set;
          sessionBestE1rm = estimate;
        }
      }
      if (!sessionBest || sessionBestE1rm <= (bestByExercise.get(exercise.id) ?? 0)) continue;
      bestByExercise.set(exercise.id, sessionBestE1rm);
      events.push({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        date: session.date,
        weightKg: sessionBest.weight,
        reps: sessionBest.reps,
        e1rmKg: sessionBestE1rm,
      });
    }
  }
  return events;
}

function exercisesForFilter(
  exercises: readonly ExerciseLog[],
  filter: TrendFilter,
  library: readonly CatalogExercise[],
): ExerciseLog[] {
  if (filter.kind === "all") return [...exercises];
  if (filter.kind === "exercise") return exercises.filter((exercise) => exercise.id === filter.exerciseId);
  return exercises.filter((exercise) => {
    const mapping = resolveLoggedExerciseMuscles(exercise, library);
    return mapping.primary === filter.muscleId || mapping.secondary.includes(filter.muscleId);
  });
}

function bucketRows(days: IndividualRange, today: string): { start: string; end: string; label: string }[] {
  const from = rangeStart(today, days);
  if (days === 7) {
    return Array.from({ length: 7 }, (_, index) => {
      const start = shiftIso(from, index);
      return { start, end: start, label: new Date(`${start}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" }) };
    });
  }
  if (days < 365) {
    const rows: { start: string; end: string; label: string }[] = [];
    let start = weekStart(from);
    while (start <= today) {
      const end = shiftIso(start, 6);
      rows.push({
        start,
        end,
        label: new Date(`${start}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      });
      start = shiftIso(start, 7);
    }
    return rows;
  }
  const rows: { start: string; end: string; label: string }[] = [];
  const fromParts = from.split("-").map(Number);
  const currentParts = today.split("-").map(Number);
  let year = fromParts[0];
  let month = fromParts[1];
  while (year < currentParts[0] || (year === currentParts[0] && month <= currentParts[1])) {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    rows.push({
      start,
      end: shiftIso(nextMonth, -1),
      label: new Date(`${start}T12:00:00`).toLocaleDateString(undefined, { month: "short" }),
    });
    if (month === 12) {
      year += 1;
      month = 1;
    } else month += 1;
  }
  return rows;
}

export function getTrainingTrend(
  owner: WorkoutOwner,
  days: IndividualRange,
  today: string,
  filter: TrendFilter,
  library: readonly CatalogExercise[],
): TrendPoint[] {
  const from = rangeStart(today, days);
  const sessions = dateSessions(owner, today).filter(({ session }) => session.date >= from);
  return bucketRows(days, today).map((bucket) => {
    const matching = sessions.filter(({ session }) => session.date >= bucket.start && session.date <= bucket.end);
    const totals = matching.reduce(
      (sum, { session }) => {
        let sessionEffectiveSets = 0;
        let sessionWorkingSets = 0;
        let sessionVolumeKg = 0;
        for (const exercise of exercisesForFilter(session.exercises, filter, library)) {
          const mapping = filter.kind === "muscle" ? resolveLoggedExerciseMuscles(exercise, library) : null;
          for (const set of workingSets(exercise.sets)) {
            sessionWorkingSets += 1;
            if (filter.kind !== "muscle" || mapping?.primary === filter.muscleId) {
              sessionVolumeKg += setVolume(set.reps, set.weight, set.kind);
            }
            if (filter.kind === "muscle" && mapping) {
              const direct = mapping.primary === filter.muscleId;
              const indirect = mapping.secondary.includes(filter.muscleId);
              if (direct || indirect) {
                sessionEffectiveSets += effortFactorFromRpe(set.rpe) * (direct ? 1 : 0.5);
              }
            }
          }
        }
        return {
          workouts: sum.workouts + (sessionWorkingSets > 0 ? 1 : 0),
          workingSets: sum.workingSets + sessionWorkingSets,
          effectiveSets: sum.effectiveSets + sessionEffectiveSets,
          volumeKg: sum.volumeKg + sessionVolumeKg,
        };
      },
      { workouts: 0, workingSets: 0, effectiveSets: 0, volumeKg: 0 },
    );
    return { ...bucket, ...totals };
  });
}

export function trendValue(point: TrendPoint, metric: TrendMetric, filter: TrendFilter): number {
  if (metric === "volume") return point.volumeKg;
  return filter.kind === "muscle" ? point.effectiveSets : point.workingSets;
}

export function trendMetricLabel(metric: TrendMetric, filter: TrendFilter, unit: Unit): string {
  if (metric === "volume") {
    return filter.kind === "muscle"
      ? `Volume for primary ${MUSCLE_GROUPS.find((muscle) => muscle.id === filter.muscleId)?.label ?? "muscle"} exercises (${unit}·reps)`
      : `Training volume (${unit}·reps)`;
  }
  return filter.kind === "muscle" ? "Weighted set equivalents" : "Working sets";
}
