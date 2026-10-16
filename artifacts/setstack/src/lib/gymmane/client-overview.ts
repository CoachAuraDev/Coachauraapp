import { WEEKDAYS, shiftIso, weekStart } from "./engine.ts";
import { bestSetOneRm, workingSets } from "./metrics.ts";
import type { MuscleActivity, MuscleGroup } from "./muscle-activity.ts";
import type { Client, MuscleTargetGroup } from "./models.ts";

export type WeeklySetPoint = {
  date: string;
  day: (typeof WEEKDAYS)[number];
  sets: number;
  isToday: boolean;
  isFuture: boolean;
};

export type StrengthExerciseOption = {
  id: string;
  name: string;
  lastLogged: string;
};

export type StrengthPoint = {
  date: string;
  e1rm: number;
};

const RADAR_GROUPS = [
  { id: "chest", label: "Chest", muscles: ["chest"] },
  { id: "shoulders", label: "Shoulders", muscles: ["front-deltoids", "side-deltoids", "rear-deltoids"] },
  { id: "arms", label: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  { id: "upper-back", label: "Upper back", muscles: ["upper-back", "lats", "traps"] },
  { id: "lower-back", label: "Lower back", muscles: ["lower-back"] },
  { id: "core", label: "Core", muscles: ["abs", "obliques"] },
  { id: "glutes", label: "Glutes", muscles: ["glutes"] },
  { id: "quads", label: "Quads", muscles: ["quadriceps"] },
  { id: "hamstrings", label: "Hamstrings", muscles: ["hamstrings"] },
  { id: "adductors", label: "Adductors", muscles: ["adductors"] },
  { id: "calves", label: "Calves", muscles: ["calves"] },
] as const satisfies readonly { id: MuscleTargetGroup; label: string; muscles: readonly MuscleGroup[] }[];

export const MUSCLE_TARGET_GROUPS = RADAR_GROUPS.map(({ id, label }) => ({ id, label }));

function validPastDate(date: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === date;
}

/** Counts completed work sets in the current Monday–Sunday week; planned and warm-up sets are excluded. */
export function weeklySetPoints(client: Client, today: string): WeeklySetPoint[] {
  const start = weekStart(today);
  return WEEKDAYS.map((day, index) => {
    const date = shiftIso(start, index);
    const sets = client.sessions
      .filter((session) => session.date === date && validPastDate(session.date, today))
      .reduce(
        (total, session) =>
          total + session.exercises.reduce((exerciseTotal, exercise) => exerciseTotal + workingSets(exercise.sets).length, 0),
        0,
      );
    return { date, day, sets, isToday: date === today, isFuture: date > today };
  });
}

/** Unique exercises with at least one valid estimated 1RM, ordered by most recently logged. */
export function strengthExerciseOptions(client: Client, today: string): StrengthExerciseOption[] {
  const byId = new Map<string, StrengthExerciseOption>();
  for (const session of client.sessions) {
    if (!validPastDate(session.date, today)) continue;
    for (const exercise of session.exercises) {
      if (bestSetOneRm(exercise.sets) <= 0) continue;
      const current = byId.get(exercise.id);
      if (!current || session.date > current.lastLogged) {
        byId.set(exercise.id, { id: exercise.id, name: exercise.name, lastLogged: session.date });
      }
    }
  }
  return [...byId.values()].sort(
    (a, b) => b.lastLogged.localeCompare(a.lastLogged) || a.name.localeCompare(b.name),
  );
}

/** One best working-set estimate per completed session for the selected exercise. */
export function estimatedStrengthHistory(client: Client, exerciseId: string, today: string): StrengthPoint[] {
  return client.sessions
    .filter((session) => validPastDate(session.date, today))
    .flatMap((session) => {
      const matching = session.exercises.filter((exercise) => exercise.id === exerciseId);
      const e1rm = matching.reduce((best, exercise) => Math.max(best, bestSetOneRm(exercise.sets)), 0);
      return e1rm > 0 ? [{ date: session.date, e1rm }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Combines the detailed activity map into readable, high-level radar categories. */
export function muscleBalanceRadar(
  muscles: readonly Pick<MuscleActivity, "id" | "weeklyEquivalent">[],
) {
  const byId = new Map(muscles.map((muscle) => [muscle.id, muscle]));
  return RADAR_GROUPS.map(({ id, label, muscles: ids }) => ({
    id,
    label,
    weeklyEquivalent: ids.reduce((sum, id) => sum + (byId.get(id)?.weeklyEquivalent ?? 0), 0),
  }));
}

/** Compares observed 30-day weekly-equivalent workload only with targets the trainer explicitly set. */
export function muscleTargetGuidance(
  activity: readonly { id: MuscleTargetGroup; label: string; weeklyEquivalent: number }[],
  targets: Client["muscleTargets"] = {},
) {
  return activity.map((group) => {
    const target = targets?.[group.id];
    return {
      ...group,
      target,
      belowTarget: target !== undefined && group.weeklyEquivalent < target,
    };
  });
}
