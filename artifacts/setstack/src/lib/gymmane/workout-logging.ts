import type { DraftEntry, ExerciseLog, Routine, SessionLog, SetLog, WorkoutOwner } from "./models.ts";
import { SET_KINDS } from "./engine.ts";

export function validLoggedSet(set: Omit<SetLog, "id">): boolean {
  return Number.isFinite(set.weight) && set.weight >= 0 &&
    SET_KINDS.includes(set.kind) &&
    Number.isInteger(set.reps) && set.reps >= 1 && set.reps <= 100 &&
    (set.rpe === null || (Number.isFinite(set.rpe) && set.rpe >= 0 && set.rpe <= 10));
}

/** Date ordering with insertion order as the same-day tie breaker. Returns copies. */
export function previousExercisePerformance(owner: WorkoutOwner, exerciseId: string): {date: string; sets: SetLog[]} | null {
  const sessions = owner.sessions.map((session, index) => ({ session, index }))
    .filter(({ session }) => /^\d{4}-\d{2}-\d{2}$/.test(session.date))
    .sort((a, b) => b.session.date.localeCompare(a.session.date) || b.index - a.index);
  for (const { session } of sessions) {
    const sets = session.exercises.filter((exercise) => exercise.id === exerciseId)
      .flatMap((exercise) => exercise.sets)
      .filter((set) => set.kind !== "warmup" && validLoggedSet(set));
    if (sets.length) return { date: session.date, sets: sets.map((set) => ({ ...set })) };
  }
  return null;
}

export function plannedSetCount(routine: Routine | undefined, exerciseId: string): number {
  if (!routine?.exerciseIds.includes(exerciseId)) return 0;
  return routine?.sets[exerciseId] ?? routine?.plan[exerciseId]?.length ?? 3;
}

export function nextSetDefaults(owner: WorkoutOwner, routine: Routine | undefined, exercise: ExerciseLog): DraftEntry {
  const working = exercise.sets.filter((set) => set.kind !== "warmup" && validLoggedSet(set));
  const previous = previousExercisePerformance(owner, exercise.id)?.sets ?? [];
  const planned = routine?.plan[exercise.id]?.[exercise.sets.length];
  const last = previous[working.length] ?? previous.at(-1) ?? working.at(-1);
  return {
    weightKg: planned?.weightKg ?? last?.weight ?? 0,
    reps: planned?.reps ?? last?.reps ?? 8,
    rir: last?.rpe == null ? null : 10 - last.rpe,
    kind: planned?.kind === "warmup" ? "warmup" : "normal",
  };
}

/** Validate edits without recalculating or rewriting untouched historical rows. */
export function validSessionEdit(session: SessionLog, previous?: SessionLog): boolean {
  const parsedDate = new Date(`${session.date}T00:00:00Z`);
  return Boolean(session.name.trim()) && Number.isFinite(parsedDate.getTime()) &&
    parsedDate.toISOString().slice(0, 10) === session.date &&
    Number.isFinite(session.durationSec) && session.durationSec >= 0 &&
    session.exercises.every((exercise) => exercise.sets.every((set) => {
      const old = previous?.exercises.find((item) => item.id === exercise.id)?.sets.find((item) => item.id === set.id);
      return (old && JSON.stringify(old) === JSON.stringify(set)) || validLoggedSet(set);
    }));
}
