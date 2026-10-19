import type { CatalogExercise } from "./catalog.ts";
import type { Client, ExerciseLog, SetLog, SessionLog } from "./models.ts";

export const MUSCLE_GROUPS = [
  { id: "chest", label: "Chest", views: ["front"] },
  { id: "front-deltoids", label: "Front deltoids", views: ["front"] },
  { id: "side-deltoids", label: "Side deltoids", views: ["front", "back"] },
  { id: "rear-deltoids", label: "Rear deltoids", views: ["back"] },
  { id: "biceps", label: "Biceps", views: ["front"] },
  { id: "triceps", label: "Triceps", views: ["back"] },
  { id: "forearms", label: "Forearms", views: ["front", "back"] },
  { id: "upper-back", label: "Upper back", views: ["back"] },
  { id: "lats", label: "Lats", views: ["back"] },
  { id: "traps", label: "Traps", views: ["back"] },
  { id: "lower-back", label: "Lower back", views: ["back"] },
  { id: "abs", label: "Abs", views: ["front"] },
  { id: "obliques", label: "Obliques", views: ["front", "back"] },
  { id: "glutes", label: "Glutes", views: ["back"] },
  { id: "quadriceps", label: "Quadriceps", views: ["front"] },
  { id: "hamstrings", label: "Hamstrings", views: ["back"] },
  { id: "adductors", label: "Adductors", views: ["front"] },
  { id: "calves", label: "Calves", views: ["front", "back"] },
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]["id"];
export type MuscleView = "front" | "back";
export type MuscleIntensity = "none" | "low" | "moderate" | "high" | "very-high";
export type RecoveryStatus =
  | "no-data"
  | "recovered"
  | "recovering"
  | "recently-trained"
  | "high-recent-workload";
export type ActivityPeriod = 7 | 30;

export type ExerciseMuscleMapping = {
  primary: MuscleGroup | null;
  secondary: MuscleGroup[];
};

export type MuscleContributor = {
  exerciseId: string;
  exerciseName: string;
  directSets: number;
  indirectSets: number;
  effectiveSetEquivalents: number;
};

export type MuscleActivity = {
  id: MuscleGroup;
  label: string;
  intensity: MuscleIntensity;
  directSets: number;
  indirectSets: number;
  effectiveSetEquivalents: number;
  weeklyEquivalent: number;
  selectedPeriodSessions: number;
  recent7DaySessions: number;
  lastWorkoutDate: string | null;
  daysSinceLastWorkout: number | null;
  estimatedRecoveryHours: number | null;
  recoveryStatus: RecoveryStatus;
  contributors: MuscleContributor[];
};

export type MuscleActivityResult = {
  period: ActivityPeriod;
  startDate: string;
  endDate: string;
  muscles: MuscleActivity[];
  completedSessions: number;
  workingSets: number;
  unmappedExercises: string[];
};

type ExerciseMetadata = Pick<CatalogExercise, "id" | "name" | "primary"> & {
  secondary?: string[];
  muscleMappingExplicit?: boolean;
};

type Workload = {
  directSets: number;
  indirectSets: number;
  effectiveSetEquivalents: number;
  contributors: Map<string, MuscleContributor>;
};

type SessionWork = {
  date: string;
  id: string;
  muscles: Map<MuscleGroup, Workload>;
};

const GROUP_BY_ID = new Map<string, MuscleGroup>(
  MUSCLE_GROUPS.map(({ id }) => [id, id]),
);

const LABEL_GROUPS: Record<string, MuscleGroup> = {
  abdomen: "abs",
  abs: "abs",
  adductor: "adductors",
  adductors: "adductors",
  back: "upper-back",
  biceps: "biceps",
  calf: "calves",
  calves: "calves",
  chest: "chest",
  forearm: "forearms",
  forearms: "forearms",
  front_deltoid: "front-deltoids",
  front_deltoids: "front-deltoids",
  glute: "glutes",
  glutes: "glutes",
  hamstring: "hamstrings",
  hamstrings: "hamstrings",
  lowerback: "lower-back",
  lower_back: "lower-back",
  oblique: "obliques",
  obliques: "obliques",
  quad: "quadriceps",
  quads: "quadriceps",
  quadriceps: "quadriceps",
  rear_deltoid: "rear-deltoids",
  rear_deltoids: "rear-deltoids",
  shoulder: "side-deltoids",
  shoulders: "side-deltoids",
  side_deltoid: "side-deltoids",
  side_deltoids: "side-deltoids",
  trapezius: "traps",
  traps: "traps",
  triceps: "triceps",
};

const MUSCLE_LABELS = new Map<string, string>(MUSCLE_GROUPS.map(({ id, label }) => [id, label]));

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}

function resolveMuscleLabel(label: string, exerciseName: string, role: "primary" | "secondary"): MuscleGroup | null {
  const key = normalizeText(label);
  const canonical = GROUP_BY_ID.get(key.replace(/\s+/g, "-"));
  if (canonical) return canonical;

  const name = normalizeText(exerciseName);
  if (role === "primary" && /\b(adductor|adduction|hip adduction)\b/.test(name)) return "adductors";

  if (key === "shoulder" || key === "shoulders" || key === "side deltoid") {
    if (/\b(rear|reverse|face pull|reverse fly|rear fly|posterior)\b/.test(name)) return "rear-deltoids";
    if (/\b(lateral raise|side raise)\b/.test(name)) return "side-deltoids";
    if (/\b(front raise|overhead|military|arnold|shoulder press|push press)\b/.test(name)) return "front-deltoids";
    return role === "primary" ? "side-deltoids" : "rear-deltoids";
  }

  if (key === "back" || key === "upper back" || key === "lat") {
    if (/\b(shrug|trapezius|trap)\b/.test(name)) return "traps";
    if (/\b(back extension|hyperextension|superman|good morning|deadlift)\b/.test(name)) return "lower-back";
    if (/\b(pulldown|pull up|chin up|pullover|lat|dead hang)\b/.test(name)) return "lats";
    if (role === "secondary" && /\b(row|face pull|reverse fly|rear)\b/.test(name)) return "rear-deltoids";
    return "upper-back";
  }

  return LABEL_GROUPS[key.replace(/\s+/g, "_")] ?? null;
}

function supplementalSecondaryMuscles(name: string, primary: MuscleGroup | null): MuscleGroup[] {
  const normalized = normalizeText(name);
  const extra: MuscleGroup[] = [];

  if (primary === "chest" && /\b(bench press|push up|chest dip|chest press|chest fly)\b/.test(normalized)) {
    extra.push("front-deltoids", "triceps");
  }
  if (primary === "upper-back" && /\b(row|face pull|reverse fly|rear fly)\b/.test(normalized)) {
    extra.push("lats", "biceps", "rear-deltoids");
  }
  if (primary === "lats" && /\b(pulldown|pull up|chin up|pullover)\b/.test(normalized)) {
    extra.push("biceps", "forearms");
  }
  if (primary === "front-deltoids" && /\b(overhead|military|arnold|shoulder press|push press)\b/.test(normalized)) {
    extra.push("side-deltoids", "triceps");
  }

  return extra;
}

export function mapExerciseMuscles(exercise: ExerciseMetadata): ExerciseMuscleMapping {
  const primary = resolveMuscleLabel(exercise.primary, exercise.name, "primary");
  const secondary = new Set<MuscleGroup>();

  for (const label of exercise.secondary ?? []) {
    const group = resolveMuscleLabel(label, exercise.name, "secondary");
    if (group && group !== primary) secondary.add(group);
  }
  for (const group of exercise.muscleMappingExplicit ? [] : supplementalSecondaryMuscles(exercise.name, primary)) {
    if (group !== primary) secondary.add(group);
  }

  return { primary, secondary: [...secondary] };
}

export function resolveLoggedExerciseMuscles(
  exercise: ExerciseLog,
  exerciseLibrary: readonly CatalogExercise[],
): ExerciseMuscleMapping {
  const saved = exerciseLibrary.find((item) => item.id === exercise.id);
  return mapExerciseMuscles(
    saved
      ? { id: saved.id, name: saved.name, primary: saved.primary, secondary: saved.secondary ?? [], muscleMappingExplicit: saved.muscleMappingExplicit }
      : { id: exercise.id, name: exercise.name, primary: exercise.primary, secondary: [] },
  );
}

export function effortFactorFromRpe(rpe: number | null): number {
  if (rpe == null || !Number.isFinite(rpe)) return 1;
  const rir = Math.max(0, Math.min(10, 10 - rpe));
  if (rir <= 1) return 1.25;
  if (rir <= 3) return 1;
  return 0.75;
}

export function intensityForWeeklyEquivalent(value: number): MuscleIntensity {
  if (value <= 0) return "none";
  if (value < 3) return "low";
  if (value < 6) return "moderate";
  if (value < 10) return "high";
  return "very-high";
}

function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

function calendarDaysBetween(from: string, to: string): number {
  const fromTime = Date.parse(`${from}T00:00:00Z`);
  const toTime = Date.parse(`${to}T00:00:00Z`);
  return Math.max(0, Math.floor((toTime - fromTime) / 86_400_000));
}

function emptyWorkload(): Workload {
  return {
    directSets: 0,
    indirectSets: 0,
    effectiveSetEquivalents: 0,
    contributors: new Map(),
  };
}

function ensureWorkload(map: Map<MuscleGroup, Workload>, group: MuscleGroup): Workload {
  let workload = map.get(group);
  if (!workload) {
    workload = emptyWorkload();
    map.set(group, workload);
  }
  return workload;
}

function addSetContribution(
  muscles: Map<MuscleGroup, Workload>,
  group: MuscleGroup,
  exercise: ExerciseLog,
  factor: number,
  direct: boolean,
): void {
  const workload = ensureWorkload(muscles, group);
  const weight = direct ? 1 : 0.5;
  if (direct) workload.directSets += 1;
  else workload.indirectSets += 1;
  workload.effectiveSetEquivalents += factor * weight;

  const existing = workload.contributors.get(exercise.id) ?? {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    directSets: 0,
    indirectSets: 0,
    effectiveSetEquivalents: 0,
  };
  if (direct) existing.directSets += 1;
  else existing.indirectSets += 1;
  existing.effectiveSetEquivalents += factor * weight;
  workload.contributors.set(exercise.id, existing);
}

function workingSet(set: SetLog): boolean {
  return set.kind !== "warmup" && Number.isFinite(set.reps) && set.reps > 0;
}

function workloadForSession(session: SessionLog, exerciseLibrary: readonly CatalogExercise[]): SessionWork {
  const muscles = new Map<MuscleGroup, Workload>();
  for (const exercise of session.exercises) {
    const mapping = resolveLoggedExerciseMuscles(exercise, exerciseLibrary);
    if (!mapping.primary) continue;
    for (const set of exercise.sets) {
      if (!workingSet(set)) continue;
      const factor = effortFactorFromRpe(set.rpe);
      addSetContribution(muscles, mapping.primary, exercise, factor, true);
      for (const group of mapping.secondary) {
        addSetContribution(muscles, group, exercise, factor, false);
      }
    }
  }
  return { date: session.date, id: session.id, muscles };
}

function estimatedRecoveryHours(lastSessionEquivalents: number, recentSessions: number): number {
  const hours = 24 + 6 * Math.min(lastSessionEquivalents, 8) + 8 * Math.max(0, recentSessions - 1);
  return Math.min(96, Math.max(24, Math.round(hours)));
}

function recoveryStatus(
  lastWorkoutDate: string | null,
  daysSinceLastWorkout: number | null,
  recent7DaySessions: number,
  recent7DayEquivalents: number,
  recoveryHours: number | null,
): RecoveryStatus {
  if (!lastWorkoutDate || daysSinceLastWorkout == null || recoveryHours == null) return "no-data";
  if (recent7DayEquivalents >= 12 || recent7DaySessions >= 3) return "high-recent-workload";
  if (daysSinceLastWorkout <= 1) return "recently-trained";
  if (daysSinceLastWorkout * 24 < recoveryHours) return "recovering";
  return "recovered";
}

function mergeContributors(target: Map<string, MuscleContributor>, incoming: Map<string, MuscleContributor>): void {
  for (const item of incoming.values()) {
    const existing = target.get(item.exerciseId) ?? { ...item, directSets: 0, indirectSets: 0, effectiveSetEquivalents: 0 };
    existing.directSets += item.directSets;
    existing.indirectSets += item.indirectSets;
    existing.effectiveSetEquivalents += item.effectiveSetEquivalents;
    target.set(item.exerciseId, existing);
  }
}

export function analyzeMuscleActivity(
  client: Client,
  exerciseLibrary: readonly CatalogExercise[],
  period: ActivityPeriod,
  today: string,
): MuscleActivityResult {
  if (!isIsoDate(today)) throw new Error(`Expected today as YYYY-MM-DD, received "${today}"`);
  // Date-only session values are compared as calendar strings; never parse
  // them as UTC instants, which would shift their displayed day west of UTC.
  const startDate = new Date(Date.parse(`${today}T00:00:00Z`) - (period - 1) * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const allWork = client.sessions
    .filter((session) => isIsoDate(session.date) && session.date <= today)
    .map((session) => workloadForSession(session, exerciseLibrary));
  const selectedWork = allWork.filter((session) => session.date >= startDate);
  const recentWork = allWork.filter((session) => session.date >= addDays(today, -6));

  const muscles = MUSCLE_GROUPS.map(({ id, label }) => {
    const selected = selectedWork.flatMap((session) => {
      const workload = session.muscles.get(id);
      return workload ? [{ session, workload }] : [];
    });
    const history = allWork.flatMap((session) => {
      const workload = session.muscles.get(id);
      return workload ? [{ session, workload }] : [];
    });
    const recent = recentWork.flatMap((session) => {
      const workload = session.muscles.get(id);
      return workload ? [{ session, workload }] : [];
    });

    const directSets = selected.reduce((sum, item) => sum + item.workload.directSets, 0);
    const indirectSets = selected.reduce((sum, item) => sum + item.workload.indirectSets, 0);
    const effectiveSetEquivalents = selected.reduce((sum, item) => sum + item.workload.effectiveSetEquivalents, 0);
    const weeklyEquivalent = effectiveSetEquivalents * (7 / period);
    const lastWorkoutDate = history.reduce<string | null>(
      (last, item) => (last == null || item.session.date > last ? item.session.date : last),
      null,
    );
    const lastDayEquivalent = lastWorkoutDate
      ? history
          .filter((item) => item.session.date === lastWorkoutDate)
          .reduce((sum, item) => sum + item.workload.effectiveSetEquivalents, 0)
      : 0;
    const daysSinceLastWorkout = lastWorkoutDate ? calendarDaysBetween(lastWorkoutDate, today) : null;
    const recent7DaySessions = recent.length;
    const recent7DayEquivalents = recent.reduce((sum, item) => sum + item.workload.effectiveSetEquivalents, 0);
    const estimatedRecovery = lastWorkoutDate
      ? estimatedRecoveryHours(lastDayEquivalent, recent7DaySessions)
      : null;
    const contributors = new Map<string, MuscleContributor>();
    for (const item of selected) mergeContributors(contributors, item.workload.contributors);

    return {
      id,
      label,
      intensity: intensityForWeeklyEquivalent(weeklyEquivalent),
      directSets,
      indirectSets,
      effectiveSetEquivalents,
      weeklyEquivalent,
      selectedPeriodSessions: selected.length,
      recent7DaySessions,
      lastWorkoutDate,
      daysSinceLastWorkout,
      estimatedRecoveryHours: estimatedRecovery,
      recoveryStatus: recoveryStatus(
        lastWorkoutDate,
        daysSinceLastWorkout,
        recent7DaySessions,
        recent7DayEquivalents,
        estimatedRecovery,
      ),
      contributors: [...contributors.values()].sort(
        (a, b) => b.effectiveSetEquivalents - a.effectiveSetEquivalents,
      ),
    } satisfies MuscleActivity;
  });

  const selectedSessions = client.sessions.filter((session) =>
    isIsoDate(session.date) && session.date >= startDate && session.date <= today,
  );
  const workingSessions = selectedSessions.filter((session) => session.exercises.some((exercise) => exercise.sets.some(workingSet)));
  const workingSets = workingSessions.reduce((total, session) =>
    total + session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter(workingSet).length, 0), 0,
  );
  const unmappedExercises = [...new Set(workingSessions.flatMap((session) =>
    session.exercises
      .filter((exercise) => exercise.sets.some(workingSet) && !resolveLoggedExerciseMuscles(exercise, exerciseLibrary).primary)
      .map((exercise) => exercise.name),
  ))];
  return { period, startDate, endDate: today, muscles, completedSessions: workingSessions.length, workingSets, unmappedExercises };
}

function addDays(date: string, offset: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10);
}

export function muscleLabel(id: MuscleGroup): string {
  return MUSCLE_LABELS.get(id) ?? id;
}

export function formatRecoveryStatus(status: RecoveryStatus): string {
  const labels: Record<RecoveryStatus, string> = {
    "no-data": "No recent work",
    recovered: "Recovered · estimate",
    recovering: "Recovering · estimate",
    "recently-trained": "Recently trained",
    "high-recent-workload": "High recent workload",
  };
  return labels[status];
}
