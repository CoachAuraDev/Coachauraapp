import { WEEKDAYS, shiftIso, weekStart } from "./engine.ts";
import { bestSetOneRm, workingSets } from "./metrics.ts";
import type { MuscleActivity, MuscleGroup } from "./muscle-activity.ts";
import type { Client } from "./models.ts";

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

const RADAR_GROUPS: { label: string; muscles: readonly MuscleGroup[] }[] = [
  { label: "Chest", muscles: ["chest"] },
  { label: "Shoulders", muscles: ["front-deltoids", "side-deltoids", "rear-deltoids"] },
  { label: "Arms", muscles: ["biceps", "triceps", "forearms"] },
  { label: "Upper back", muscles: ["upper-back", "lats", "traps"] },
  { label: "Lower back", muscles: ["lower-back"] },
  { label: "Core", muscles: ["abs", "obliques"] },
  { label: "Glutes", muscles: ["glutes"] },
  { label: "Quads", muscles: ["quadriceps"] },
  { label: "Hamstrings", muscles: ["hamstrings"] },
  { label: "Adductors", muscles: ["adductors"] },
  { label: "Calves", muscles: ["calves"] },
];

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
  return RADAR_GROUPS.map(({ label, muscles: ids }) => ({
    label,
    weeklyEquivalent: ids.reduce((sum, id) => sum + (byId.get(id)?.weeklyEquivalent ?? 0), 0),
  }));
}
