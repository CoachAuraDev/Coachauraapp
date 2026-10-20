import type { SetKind, Sex } from "./engine";

export type SetLog = {
  id: string;
  reps: number;
  weight: number;
  kind: SetKind;
  rpe: number | null;
};

export type ExerciseLog = {
  id: string;
  name: string;
  primary: string;
  equipment: string;
  sets: SetLog[];
};

export type SessionLog = {
  id: string;
  date: string;
  durationSec: number;
  name: string;
  routineId: string | null;
  exercises: ExerciseLog[];
};

export type MuscleTargetGroup =
  | "chest"
  | "shoulders"
  | "arms"
  | "upper-back"
  | "lower-back"
  | "core"
  | "glutes"
  | "quads"
  | "hamstrings"
  | "adductors"
  | "calves";

export type PlannedSet = {
  reps: number | null;
  weightKg: number | null;
  kind: SetKind;
};

export type Routine = {
  id: string;
  name: string;
  group: string;
  exerciseIds: string[];
  sets: Record<string, number>;
  plan: Record<string, PlannedSet[]>;
  rest: Record<string, number>;
};

export type Client = {
  id: string;
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number;
  weeklyGoal: number;
  neckCm: number | null;
  waistCm: number | null;
  hipCm: number | null;
  notes: string;
  restSeconds: number;
  since: string;
  sessions: SessionLog[];
  routines: Routine[];
  weeklyPlan: Record<string, string>;
  bodyweight: { date: string; kg: number }[];
  /** Optional trainer-defined weekly workload guidance, in weighted set equivalents. */
  muscleTargets?: Partial<Record<MuscleTargetGroup, number>>;
};

/** Stable owner ID keeps individual sessions distinct from every trainer-managed client. */
export const INDIVIDUAL_PROFILE_ID = "__coachaura_individual__";
export type TrainingMode = "trainer" | "individual";
export type IndividualProfile = {
  restSeconds: number;
  sessions: SessionLog[];
  /** Personal workout plans are separate from trainer-client routines. */
  plans?: Routine[];
};
/** The smallest shared shape needed by workout logging and saved-session analytics. */
export type WorkoutOwner = Pick<Client, "id" | "name" | "restSeconds" | "sessions" | "routines">;
export function individualWorkoutOwner(profile: IndividualProfile): WorkoutOwner {
  return {
    id: INDIVIDUAL_PROFILE_ID,
    name: "My training",
    restSeconds: profile.restSeconds,
    sessions: profile.sessions,
    routines: profile.plans ?? [],
  };
}

export type Draft = {
  clientId: string;
  routineId: string | null;
  name: string;
  startedAt: number;
  restUntil: number | null;
  activeIndex: number;
  exercises: ExerciseLog[];
  entries?: Record<string, DraftEntry>;
  restPausedSeconds?: number | null;
  restDurationSeconds?: number;
  restOverrideSeconds?: number;
  timerSound?: boolean;
  timerVibration?: boolean;
};

export type DraftEntry = {
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  kind: "normal" | "warmup";
  // Editable input is not a logged set: retain exact text and its display unit.
  inputs?: { weight: string; reps: string; rir: string; unit: "kg" | "lb" };
};
