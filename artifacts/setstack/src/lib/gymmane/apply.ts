import type { CatalogExercise } from "./catalog.ts";
import { uid } from "./engine.ts";
import { matchExercise } from "./match.ts";
import type { Client, Routine } from "./models.ts";
import type { ProgramTemplate } from "./programs.ts";

export function blankRoutine(name = "New routine"): Routine {
  return { id: uid(), name, group: "", exerciseIds: [], sets: {}, plan: {}, rest: {} };
}

/** GymMane applyTemplate: identical days share one routine; the week is filled only when it was empty. */
export function installProgram(
  client: Client,
  template: ProgramTemplate,
  pool: readonly CatalogExercise[],
): { client: Client; made: number; missed: string[] } {
  const planWasEmpty = Object.keys(client.weeklyPlan).length === 0;
  const routines = [...client.routines];
  const weeklyPlan = { ...client.weeklyPlan };
  const missed = new Set<string>();
  const sameDay = new Map<string, string>();
  let made = 0;

  for (const day of template.days) {
    const ids = new Map<string, number>();
    for (const [name, sets] of day.exercises) {
      const exercise = matchExercise(name, pool);
      if (!exercise || ids.has(exercise.id)) {
        if (!exercise) missed.add(name);
        continue;
      }
      ids.set(exercise.id, sets);
    }
    if (ids.size === 0) continue;
    const key = `${day.name}|${[...ids.entries()].map(([id, sets]) => `${id}:${sets}`).join(",")}`;
    const twin = sameDay.get(key);
    if (twin) {
      if (planWasEmpty && day.weekday != null) weeklyPlan[String(day.weekday)] = twin;
      continue;
    }
    const id = uid();
    sameDay.set(key, id);
    const sets: Record<string, number> = {};
    for (const [exerciseId, count] of ids) sets[exerciseId] = count;
    routines.push({
      id,
      name: day.name,
      group: template.name,
      exerciseIds: [...ids.keys()],
      sets,
      plan: {},
      rest: {},
    });
    if (planWasEmpty && day.weekday != null) weeklyPlan[String(day.weekday)] = id;
    made += 1;
  }

  return { client: { ...client, routines, weeklyPlan }, made, missed: [...missed] };
}
