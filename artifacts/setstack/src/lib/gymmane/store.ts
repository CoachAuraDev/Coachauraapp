import { create } from "zustand";
import { createJSONStorage } from "zustand/middleware";
import { durablePersist, PersistenceFailure, withRecoveryWrite } from "./durable-persistence.ts";
import { encodeBackup, inspectBackup, validateSavedFloor, type BackupResult } from "./backup.ts";
import { installProgram } from "./apply.ts";
import { kExercises, type CatalogExercise } from "./catalog.ts";
import { guessMuscle } from "./match.ts";
import {
  INDIVIDUAL_PROFILE_ID,
  individualWorkoutOwner,
  type Client,
  type Draft,
  type DraftEntry,
  type ExerciseLog,
  type IndividualProfile,
  type IndividualScheduleEntry,
  type Routine,
  type SessionLog,
  type SetLog,
  type TrainingMode,
  type WeekdayNumber,
  type WorkoutOwner,
} from "./models.ts";
import { validLoggedSet, validSessionEdit } from "./workout-logging.ts";
import { kProgramTemplates } from "./programs.ts";
import { seedClients } from "./seed.ts";
import { uid, type SetKind, type Unit } from "./engine.ts";
import { MUSCLE_GROUPS, type MuscleGroup } from "./muscle-activity.ts";
import { hasBillingLifetimeAccess } from "../billing/access.ts";
import { canCreateClient } from "../billing/entitlement.ts";
import { DEFAULT_APPEARANCE, type AppearanceTheme } from "./appearance.ts";

type FloorState = {
  clients: Client[];
  trainingMode: TrainingMode;
  individualProfile: IndividualProfile;
  unit: Unit;
  appearance: AppearanceTheme;
  draft: Draft | null;
  custom: CatalogExercise[];
  templates: Routine[];
  notice: string | null;
  setUnit: (unit: Unit) => void;
  setAppearance: (appearance: AppearanceTheme) => void;
  setTrainingMode: (mode: TrainingMode) => void;
  setNotice: (notice: string | null) => void;
  addClient: (client: Client) => boolean;
  updateClient: (id: string, patch: Partial<Client>) => void;
  deleteClient: (id: string) => void;
  setRest: (id: string, seconds: number) => void;
  addBodyweight: (id: string, kg: number) => void;
  saveRoutine: (clientId: string, routine: Routine) => void;
  saveIndividualPlan: (routine: Routine) => boolean;
  deleteIndividualPlan: (routineId: string) => boolean;
  setIndividualScheduleDay: (weekday: WeekdayNumber, entry: IndividualScheduleEntry | null) => boolean;
  saveTemplate: (routine: Routine) => void;
  deleteTemplate: (id: string) => void;
  assignTemplate: (clientId: string, templateId: string) => void;
  deleteRoutine: (clientId: string, routineId: string) => void;
  setPlanDay: (clientId: string, weekday: number, routineId: string | null) => void;
  clearPlan: (clientId: string) => void;
  assignProgram: (clientId: string, templateId: string) => void;
  addCustom: (name: string, primary?: MuscleGroup, secondary?: MuscleGroup[]) => CatalogExercise;
  updateCustomMuscles: (id: string, primary: MuscleGroup, secondary: MuscleGroup[]) => void;
  startSession: (clientId: string, routineId: string | null) => void;
  discardDraft: () => void;
  setActive: (index: number) => void;
  addDraftExercise: (exercise: CatalogExercise) => void;
  moveDraftExercise: (fromIndex: number, toIndex: number) => void;
  removeDraftExercise: (index: number) => void;
  logSet: (set: Omit<SetLog, "id">) => void;
  setDraftEntry: (exerciseId: string, entry: DraftEntry) => void;
  updateDraftSet: (exerciseIndex: number, setId: string, patch: Partial<Omit<SetLog, "id">>) => boolean;
  removeSet: (exerciseIndex: number, setId: string) => void;
  skipRest: () => void;
  bumpRest: (seconds: number) => void;
  configureRest: (seconds: number, sound?: boolean, vibration?: boolean) => void;
  startRest: () => void;
  pauseRest: () => void;
  resetRest: () => void;
  finishSession: () => string | null;
  deleteSession: (clientId: string, sessionId: string) => void;
  updateSession: (clientId: string, session: SessionLog) => boolean;
  exportBackup: () => string;
  previewBackup: (raw: string) => BackupResult;
  importBackup: (raw: string) => string;
  resetDemo: () => void;
};

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => data.delete(key),
    setItem: (key, value) => data.set(key, value),
  };
}

function patchClient(clients: Client[], id: string, update: (client: Client) => Client): Client[] {
  return clients.map((client) => (client.id === id ? update(client) : client));
}

function workoutOwner(state: Pick<FloorState, "clients" | "individualProfile">, id: string): WorkoutOwner | undefined {
  if (id === INDIVIDUAL_PROFILE_ID) return individualWorkoutOwner(state.individualProfile);
  return state.clients.find((client) => client.id === id);
}

export const useFloor = create<FloorState>()(
  durablePersist(
    (set, get) => ({
      // Demo data remains opt-in in Settings. Never substitute it for a failed read.
      clients: typeof window === "undefined" ? seedClients() : [],
      trainingMode: "trainer",
      individualProfile: { restSeconds: 90, sessions: [], plans: [], weeklySchedule: {} },
      unit: "kg",
      appearance: DEFAULT_APPEARANCE,
      draft: null,
      custom: [],
      templates: [],
      notice: null,
      setUnit: (unit) => set({ unit }),
      setAppearance: (appearance) => set({ appearance }),
      setTrainingMode: (trainingMode) => set({ trainingMode }),
      setNotice: (notice) => set({ notice }),
      addClient: (client) => {
        const clients = get().clients;
        if (client.id === INDIVIDUAL_PROFILE_ID) return false;
        if (!canCreateClient(clients.length, hasBillingLifetimeAccess())) return false;
        set({ clients: [client, ...clients] });
        return true;
      },
      updateClient: (id, patch) =>
        set({ clients: patchClient(get().clients, id, (client) => ({ ...client, ...patch, id: client.id })) }),
      deleteClient: (id) =>
        set({
          clients: get().clients.filter((client) => client.id !== id),
          draft: get().draft?.clientId === id ? null : get().draft,
        }),
      setRest: (id, seconds) => {
        const state = get();
        const restSeconds = seconds <= 0 ? 0 : Math.min(600, Math.max(15, seconds));
        if (id === INDIVIDUAL_PROFILE_ID) {
          set({ individualProfile: { ...state.individualProfile, restSeconds } });
        } else {
          set({ clients: patchClient(state.clients, id, (client) => ({ ...client, restSeconds })) });
        }
      },
      addBodyweight: (id, kg) =>
        set({
          clients: patchClient(get().clients, id, (client) => ({
            ...client,
            weightKg: kg,
            bodyweight: [...client.bodyweight, { date: new Date().toISOString().slice(0, 10), kg }],
          })),
        }),
      saveRoutine: (clientId, routine) =>
        set({
          clients: patchClient(get().clients, clientId, (client) => {
            const exists = client.routines.some((item) => item.id === routine.id);
            return {
              ...client,
              routines: exists
                ? client.routines.map((item) => (item.id === routine.id ? structuredClone(routine) : item))
                : [...client.routines, structuredClone(routine)],
            };
          }),
        }),
      saveIndividualPlan: (routine) => {
        const profile = get().individualProfile;
        const plans = profile.plans ?? [];
        const updated = plans.some((item) => item.id === routine.id)
          ? plans.map((item) => item.id === routine.id ? structuredClone(routine) : item)
          : [...plans, structuredClone(routine)];
        try {
          set({ individualProfile: { ...profile, plans: updated } });
          return true;
        } catch (error) {
          if (error instanceof PersistenceFailure) return false;
          throw error;
        }
      },
      deleteIndividualPlan: (routineId) => {
        const profile = get().individualProfile;
        const plans = profile.plans ?? [];
        if (!plans.some((item) => item.id === routineId)) return false;
        const weeklySchedule = Object.fromEntries(
          Object.entries(profile.weeklySchedule ?? {}).filter(([, entry]) =>
            entry?.kind !== "workout" || entry.routineId !== routineId,
          ),
        ) as IndividualProfile["weeklySchedule"];
        try {
          set({
            individualProfile: {
              ...profile,
              plans: plans.filter((item) => item.id !== routineId),
              weeklySchedule,
            },
          });
          return true;
        } catch (error) {
          if (error instanceof PersistenceFailure) return false;
          throw error;
        }
      },
      setIndividualScheduleDay: (weekday, entry) => {
        if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) return false;
        const profile = get().individualProfile;
        if (entry?.kind === "workout" && !(profile.plans ?? []).some((plan) => plan.id === entry.routineId)) return false;
        const weeklySchedule = { ...(profile.weeklySchedule ?? {}) };
        if (entry === null) delete weeklySchedule[weekday];
        else weeklySchedule[weekday] = structuredClone(entry);
        try {
          set({ individualProfile: { ...profile, weeklySchedule } });
          return true;
        } catch (error) {
          if (error instanceof PersistenceFailure) return false;
          throw error;
        }
      },
      saveTemplate: (routine) => set({
        templates: get().templates.some((item) => item.id === routine.id)
          ? get().templates.map((item) => item.id === routine.id ? structuredClone(routine) : item)
          : [...get().templates, structuredClone(routine)],
      }),
      deleteTemplate: (id) => set({ templates: get().templates.filter((item) => item.id !== id) }),
      assignTemplate: (clientId, templateId) => {
        const template = get().templates.find((item) => item.id === templateId);
        if (!template || !get().clients.some((client) => client.id === clientId)) return;
        const routine = { ...structuredClone(template), id: uid() };
        get().saveRoutine(clientId, routine);
        set({ notice: `${routine.name} assigned. Client results remain independent.` });
      },
      deleteRoutine: (clientId, routineId) =>
        set({
          clients: patchClient(get().clients, clientId, (client) => ({
            ...client,
            routines: client.routines.filter((routine) => routine.id !== routineId),
            weeklyPlan: Object.fromEntries(
              Object.entries(client.weeklyPlan).filter(([, id]) => id !== routineId),
            ),
          })),
        }),
      setPlanDay: (clientId, weekday, routineId) =>
        set({
          clients: patchClient(get().clients, clientId, (client) => {
            const weeklyPlan = { ...client.weeklyPlan };
            if (routineId) weeklyPlan[String(weekday)] = routineId;
            else delete weeklyPlan[String(weekday)];
            return { ...client, weeklyPlan };
          }),
        }),
      clearPlan: (clientId) =>
        set({ clients: patchClient(get().clients, clientId, (client) => ({ ...client, weeklyPlan: {} })) }),
      assignProgram: (clientId, templateId) => {
        const template = kProgramTemplates.find((item) => item.id === templateId);
        const client = get().clients.find((item) => item.id === clientId);
        if (!template || !client) return;
        const result = installProgram(client, template, [...kExercises, ...get().custom]);
        const missed = result.missed.length ? ` Unmatched: ${result.missed.join(", ")}.` : "";
        const scheduled = Object.keys(client.weeklyPlan).length === 0 ? " Week filled." : " Week left unchanged.";
        set({
          clients: patchClient(get().clients, clientId, () => result.client),
          notice: result.made
            ? `${template.name}: ${result.made} routine${result.made === 1 ? "" : "s"} added.${scheduled}${missed}`
            : `Nothing in ${template.name} matched the library.`,
        });
      },
      addCustom: (name, primary, secondary = []) => {
        const exercise: CatalogExercise = {
          id: uid(),
          name: name.trim(),
          primary: primary ?? guessMuscle(name) ?? "other",
          secondary: [...new Set(secondary.filter((group) => group !== primary && MUSCLE_GROUPS.some((item) => item.id === group)))],
          equipment: "Other",
          difficulty: "Beginner",
          mode: "",
          muscleMappingExplicit: primary != null,
        };
        set({ custom: [...get().custom, exercise] });
        return exercise;
      },
      updateCustomMuscles: (id, primary, secondary) => {
        if (!MUSCLE_GROUPS.some((group) => group.id === primary)) return;
        set({
          custom: get().custom.map((exercise) => exercise.id === id ? {
            ...exercise,
            primary,
            secondary: [...new Set(secondary.filter((group) => group !== primary && MUSCLE_GROUPS.some((item) => item.id === group)))],
            muscleMappingExplicit: true,
          } : exercise),
          notice: "Custom exercise muscle mapping saved. Historical analytics use this mapping.",
        });
      },
      startSession: (clientId, routineId) => {
        if (get().draft) {
          set({ notice: "Resumed the unfinished workout. Finish or explicitly discard it before starting another." });
          if (typeof window !== "undefined") window.dispatchEvent(new Event("setstack:resume-workout"));
          return;
        }
        const owner = workoutOwner(get(), clientId);
        if (!owner) return;
        const routine = routineId ? owner.routines.find((item) => item.id === routineId) : null;
        if (routineId !== null && !routine) return;
        const pool = [...kExercises, ...get().custom];
        const exercises: ExerciseLog[] = (routine?.exerciseIds ?? []).map((id) => {
          const info = pool.find((exercise) => exercise.id === id);
          return {
            id,
            name: info?.name ?? "Exercise",
            primary: info?.primary ?? "other",
            equipment: info?.equipment ?? "Other",
            sets: [],
          };
        });
        set({
          draft: {
            clientId,
            routineId: routine?.id ?? null,
            name: routine?.name ?? "Session",
            startedAt: Date.now(),
            restUntil: null,
            activeIndex: 0,
            exercises,
            entries: {},
            restPausedSeconds: null,
            restDurationSeconds: routine?.rest[exercises[0]?.id ?? ""] ?? owner.restSeconds,
          },
        });
      },
      discardDraft: () => set({ draft: null }),
      setActive: (index) => {
        const draft = get().draft;
        if (!draft) return;
        const activeIndex = Math.max(0, Math.min(draft.exercises.length - 1, index));
        const owner = workoutOwner(get(), draft.clientId);
        const routine = owner?.routines.find((item) => item.id === draft.routineId);
        const duration = draft.restOverrideSeconds ?? routine?.rest[draft.exercises[activeIndex]?.id ?? ""] ?? owner?.restSeconds ?? 90;
        set({ draft: { ...draft, activeIndex, restDurationSeconds: duration } });
      },
      addDraftExercise: (exercise) => {
        const draft = get().draft;
        if (!draft || draft.exercises.some((item) => item.id === exercise.id)) return;
        const next: ExerciseLog = {
          id: exercise.id,
          name: exercise.name,
          primary: exercise.primary,
          equipment: exercise.equipment,
          sets: [],
        };
        set({
          draft: { ...draft, exercises: [...draft.exercises, next], activeIndex: draft.exercises.length },
        });
      },
      moveDraftExercise: (fromIndex, toIndex) => {
        const draft = get().draft;
        if (!draft || fromIndex === toIndex
          || fromIndex < 0 || fromIndex >= draft.exercises.length
          || toIndex < 0 || toIndex >= draft.exercises.length) return;
        const activeId = draft.exercises[draft.activeIndex]?.id;
        const exercises = [...draft.exercises];
        const [moved] = exercises.splice(fromIndex, 1);
        if (!moved) return;
        exercises.splice(toIndex, 0, moved);
        const activeIndex = activeId
          ? exercises.findIndex((exercise) => exercise.id === activeId)
          : Math.max(0, Math.min(draft.activeIndex, exercises.length - 1));
        set({ draft: { ...draft, exercises, activeIndex } });
      },
      removeDraftExercise: (index) => {
        const draft = get().draft;
        if (!draft) return;
        const exercises = draft.exercises.filter((_, item) => item !== index);
        set({
          draft: {
            ...draft,
            exercises,
            activeIndex: Math.max(0, Math.min(draft.activeIndex, exercises.length - 1)),
          },
        });
      },
      logSet: (entry) => {
        if (!validLoggedSet(entry)) return;
        const draft = get().draft;
        if (!draft || draft.exercises.length === 0) return;
        const owner = workoutOwner(get(), draft.clientId);
        const routine = owner?.routines.find((item) => item.id === draft.routineId);
        const exercises = draft.exercises.map((exercise, index) =>
          index === draft.activeIndex
            ? { ...exercise, sets: [...exercise.sets, { ...entry, id: uid() }] }
            : exercise,
        );
        const active = exercises[draft.activeIndex];
        const rest = active ? (draft.restOverrideSeconds ?? routine?.rest[active.id] ?? owner?.restSeconds ?? 90) : 0;
        set({
          draft: {
            ...draft,
            exercises,
            restUntil: rest > 0 ? Date.now() + rest * 1000 : null,
            restDurationSeconds: rest,
            restPausedSeconds: null,
            entries: Object.fromEntries(Object.entries(draft.entries ?? {}).filter(([id]) => id !== active?.id)),
          },
        });
      },
      setDraftEntry: (exerciseId, entry) => {
        const draft = get().draft;
        if (!draft || !draft.exercises.some((exercise) => exercise.id === exerciseId)) return;
        set({ draft: { ...draft, entries: { ...draft.entries, [exerciseId]: { ...entry } } } });
      },
      updateDraftSet: (exerciseIndex, setId, patch) => {
        const draft = get().draft;
        const original = draft?.exercises[exerciseIndex]?.sets.find((item) => item.id === setId);
        if (!draft || !original) return false;
        const next = { ...original, ...patch, id: original.id };
        if (!validLoggedSet(next)) return false;
        set({ draft: { ...draft, exercises: draft.exercises.map((exercise, index) =>
          index === exerciseIndex ? { ...exercise, sets: exercise.sets.map((item) => item.id === setId ? next : item) } : exercise) } });
        return true;
      },
      removeSet: (exerciseIndex, setId) => {
        const draft = get().draft;
        if (!draft) return;
        set({
          draft: {
            ...draft,
            exercises: draft.exercises.map((exercise, index) =>
              index === exerciseIndex
                ? { ...exercise, sets: exercise.sets.filter((set) => set.id !== setId) }
                : exercise,
            ),
          },
        });
      },
      skipRest: () => {
        const draft = get().draft;
        if (draft) set({ draft: { ...draft, restUntil: null, restPausedSeconds: null } });
      },
      bumpRest: (seconds) => {
        const draft = get().draft;
        if (!draft?.restUntil) return;
        set({ draft: { ...draft, restUntil: draft.restUntil + seconds * 1000 } });
      },
      configureRest: (seconds, sound, vibration) => {
        const draft = get().draft;
        if (!draft || !Number.isFinite(seconds)) return;
        const duration = Math.max(0, Math.min(600, Math.round(seconds)));
        set({ draft: { ...draft, restDurationSeconds: duration, restOverrideSeconds: duration,
          ...(sound == null ? {} : { timerSound: sound }),
          ...(vibration == null ? {} : { timerVibration: vibration }) } });
      },
      startRest: () => {
        const draft = get().draft;
        if (!draft) return;
        const owner = workoutOwner(get(), draft.clientId);
        const seconds = draft.restPausedSeconds ?? draft.restDurationSeconds ?? owner?.restSeconds ?? 90;
        set({ draft: { ...draft, restUntil: seconds > 0 ? Date.now() + seconds * 1000 : null, restPausedSeconds: null } });
      },
      pauseRest: () => {
        const draft = get().draft;
        if (!draft?.restUntil) return;
        set({ draft: { ...draft, restPausedSeconds: Math.max(0, Math.ceil((draft.restUntil - Date.now()) / 1000)), restUntil: null } });
      },
      resetRest: () => {
        const draft = get().draft;
        if (draft) set({ draft: { ...draft, restUntil: null, restPausedSeconds: null } });
      },
      finishSession: () => {
        const draft = get().draft;
        if (!draft) return null;
        const exercises = draft.exercises.filter((exercise) => exercise.sets.length > 0);
        if (exercises.length === 0) {
          set({ draft: null, notice: "Nothing was logged, so the session was discarded." });
          return draft.clientId;
        }
        const date = new Date().toISOString().slice(0, 10);
        const started = new Date(draft.startedAt);
        const localDate = `${started.getFullYear()}-${String(started.getMonth() + 1).padStart(2, "0")}-${String(started.getDate()).padStart(2, "0")}`;
        const session = {
          id: uid(),
          date: localDate || date,
          durationSec: Math.max(60, Math.round((Date.now() - draft.startedAt) / 1000)),
          name: draft.name,
          routineId: draft.routineId,
          exercises,
        };
        const state = get();
        if (draft.clientId === INDIVIDUAL_PROFILE_ID) {
          set({ draft: null, individualProfile: { ...state.individualProfile, sessions: [...state.individualProfile.sessions, session] } });
        } else {
          set({
            draft: null,
            clients: patchClient(state.clients, draft.clientId, (client) => ({
              ...client,
              sessions: [...client.sessions, session],
            })),
          });
        }
        return draft.clientId;
      },
      deleteSession: (clientId, sessionId) => {
        const state = get();
        if (clientId === INDIVIDUAL_PROFILE_ID) {
          set({ individualProfile: { ...state.individualProfile, sessions: state.individualProfile.sessions.filter((session) => session.id !== sessionId) } });
        } else {
          set({ clients: patchClient(state.clients, clientId, (client) => ({
            ...client,
            sessions: client.sessions.filter((session) => session.id !== sessionId),
          })) });
        }
      },
      updateSession: (clientId, session) => {
        const state = get();
        const owner = workoutOwner(state, clientId);
        const previous = owner?.sessions.find((item) => item.id === session.id);
        if (!previous || !validSessionEdit(session, previous)) return false;
        try {
          if (clientId === INDIVIDUAL_PROFILE_ID) {
            set({ individualProfile: {
              ...state.individualProfile,
              sessions: state.individualProfile.sessions.map((saved) => saved.id === session.id ? structuredClone(session) : saved),
            } });
          } else {
            set({ clients: patchClient(state.clients, clientId, (item) => ({
              ...item, sessions: item.sessions.map((saved) => saved.id === session.id ? structuredClone(session) : saved),
            })) });
          }
        } catch (error) {
          if (error instanceof PersistenceFailure) return false;
          throw error;
        }
        return true;
      },
      exportBackup: () => {
        const { clients, custom, templates, draft, unit, appearance, trainingMode, individualProfile } = get();
        return encodeBackup({ clients, custom, templates, draft, unit, appearance, trainingMode, individualProfile });
      },
      previewBackup: (raw) => inspectBackup(raw, get()),
      importBackup: (raw) => {
        // Revalidate at confirmation time; a preview alone is not permission to
        // trust mutable data or a different current workspace.
        const result = inspectBackup(raw, get());
        if (!result.ok) return result.error;
        try {
          const options = useFloor.persist.getOptions();
          const name = options.name ?? "setstack-v1";
          const key = `${name}.before-restore`;
          if (typeof window !== "undefined") {
            // Preserve exact original bytes, even when hydration found bad JSON.
            const original = window.localStorage.getItem(name);
            if (original !== null) window.localStorage.setItem(key, original);
          } else {
            const original = options.storage?.getItem(name);
            if (original && typeof (original as Promise<unknown>).then === "function") {
              return "Restore requires synchronous local storage.";
            }
            if (original) options.storage?.setItem(key, original as never);
          }
          withRecoveryWrite(() => set({
            ...result.preview.data,
            notice: result.preview.preservesCurrentIndividualData
              ? `Restored ${result.preview.clients} client${result.preview.clients === 1 ? "" : "s"}; kept ${result.preview.data.individualProfile!.sessions.length} personal workout${result.preview.data.individualProfile!.sessions.length === 1 ? "" : "s"}, ${result.preview.data.individualProfile!.plans?.length ?? 0} plan${result.preview.data.individualProfile!.plans?.length === 1 ? "" : "s"} and training mode.`
              : `Restored ${result.preview.clients} client${result.preview.clients === 1 ? "" : "s"}, ${result.preview.data.individualProfile!.sessions.length} personal workout${result.preview.data.individualProfile!.sessions.length === 1 ? "" : "s"} and ${result.preview.data.individualProfile!.plans?.length ?? 0} personal plan${result.preview.data.individualProfile!.plans?.length === 1 ? "" : "s"}.`,
          }));
          return "";
        } catch (error) {
          return `Restore was not applied. ${error instanceof Error ? error.message : "Storage failed."}`;
        }
      },
      resetDemo: () => set({ clients: seedClients(), custom: [], templates: [], draft: null, notice: "Demo floor reloaded." }),
    }),
    {
      name: "setstack-v1",
      skipHydration: true,
      storage: createJSONStorage(() => (typeof window === "undefined" ? memoryStorage() : localStorage)),
      partialize: (state) => ({
        clients: state.clients,
        trainingMode: state.trainingMode,
        individualProfile: state.individualProfile,
        unit: state.unit,
        appearance: state.appearance,
        draft: state.draft,
        custom: state.custom,
        templates: state.templates,
      }),
      merge: (persisted, current) => ({ ...current, ...validateSavedFloor(persisted) }),
    },
  ),
);

export function exercisePool(): CatalogExercise[] {
  return [...kExercises, ...useFloor.getState().custom];
}
