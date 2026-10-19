import { daysBetween, oneRm, shiftIso, todayIso, weekStart } from "./engine.ts";
import { personalRecords, workingSets } from "./metrics.ts";
import type { Client, ExerciseLog, SessionLog, SetLog } from "./models.ts";

export type AchievementCategory = "workouts" | "strength" | "consistency" | "progress";

export const ACHIEVEMENT_CATEGORIES: { id: AchievementCategory; label: string }[] = [
  { id: "workouts", label: "Workouts" },
  { id: "strength", label: "Strength" },
  { id: "consistency", label: "Consistency" },
  { id: "progress", label: "Progress" },
];

export type AchievementDefinition = {
  id: string;
  category: AchievementCategory;
  name: string;
  description: string;
  requirement: string;
};

export const ACHIEVEMENT_DEFINITIONS: AchievementDefinition[] = [
  { id: "first-workout", category: "workouts", name: "First Workout", description: "The first saved workout is on the training record.", requirement: "Save a completed workout with at least one working set." },
  { id: "workouts-10", category: "workouts", name: "10 Workouts", description: "Ten completed workouts are on the training record.", requirement: "Save 10 completed workouts with working sets." },
  { id: "workouts-25", category: "workouts", name: "25 Workouts", description: "Twenty-five completed workouts are on the training record.", requirement: "Save 25 completed workouts with working sets." },
  { id: "workouts-50", category: "workouts", name: "50 Workouts", description: "Fifty completed workouts are on the training record.", requirement: "Save 50 completed workouts with working sets." },
  { id: "workouts-100", category: "workouts", name: "100 Workouts", description: "One hundred completed workouts are on the training record.", requirement: "Save 100 completed workouts with working sets." },
  { id: "first-personal-record", category: "strength", name: "First Personal Record", description: "A saved working set established the first estimated 1RM record.", requirement: "Log a working set with a positive estimated 1RM." },
  { id: "new-estimated-1rm", category: "strength", name: "New Estimated 1RM Record", description: "A working set exceeded the client's earlier estimated 1RM for that exercise.", requirement: "Set a higher estimated 1RM than an earlier saved set for the same exercise." },
  { id: "bench-press-milestone", category: "strength", name: "Bench Press Milestone", description: "The first working set for a bench press exercise was saved.", requirement: "Save a working set for an exercise named as a bench press." },
  { id: "squat-milestone", category: "strength", name: "Squat Milestone", description: "The first working set for a squat exercise was saved.", requirement: "Save a working set for an exercise named as a squat." },
  { id: "deadlift-milestone", category: "strength", name: "Deadlift Milestone", description: "The first working set for a deadlift exercise was saved.", requirement: "Save a working set for an exercise named as a deadlift." },
  { id: "three-workouts-one-week", category: "consistency", name: "3 Workouts in One Week", description: "Three saved workouts landed within the same Monday-to-Sunday calendar week.", requirement: "Save three qualifying workouts in one ISO calendar week." },
  { id: "four-week-streak", category: "consistency", name: "4-Week Training Streak", description: "At least one saved workout appears in each of four consecutive calendar weeks.", requirement: "Save at least one qualifying workout in four consecutive ISO calendar weeks." },
  { id: "ten-weeks-consistent", category: "consistency", name: "10 Weeks Consistent", description: "At least one saved workout appears in each of ten consecutive calendar weeks.", requirement: "Save at least one qualifying workout in ten consecutive ISO calendar weeks." },
  { id: "first-body-measurement", category: "progress", name: "First Body Measurement", description: "The first dated bodyweight measurement was saved.", requirement: "Record a dated bodyweight entry." },
  { id: "thirty-days-tracking", category: "progress", name: "30 Days of Tracking", description: "Saved workouts or bodyweight measurements span at least 30 calendar days.", requirement: "Have saved workout or bodyweight records at least 30 days apart." },
];

export const ACHIEVEMENT_STORAGE_KEY = "coachaura-achievements-v1";
export const ACHIEVEMENT_LEDGER_EVENT = "coachaura-achievement-ledger-updated";

export type AchievementAward = {
  id: string;
  unlockedAt: string;
  milestone: string;
};

type StoredAward = AchievementAward & { celebrated: boolean };
type ClientLedger = { awards: Record<string, StoredAward>; pending: string[] };
export type AchievementLedger = {
  version: 1;
  initialized: boolean;
  clients: Record<string, ClientLedger>;
};

export type AchievementStorage = Pick<Storage, "getItem" | "setItem">;

type OrderedSession = { session: SessionLog; originalIndex: number };
type SetEvent = { date: string; exercise: ExerciseLog; set: SetLog; e1rm: number };

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function formatKg(value: number): string {
  return `${Number(value.toFixed(1))} kg`;
}

function setMilestone(exercise: ExerciseLog, set: SetLog, e1rm: number): string {
  return `${exercise.name}: ${formatKg(set.weight)} × ${set.reps} reps; estimated 1RM ${formatKg(e1rm)}.`;
}

function qualifiesAsWorkout(session: SessionLog): boolean {
  return Array.isArray(session.exercises)
    && session.exercises.some((exercise) => Array.isArray(exercise.sets) && workingSets(exercise.sets).length > 0);
}

function orderedSessions(client: Client, today: string): OrderedSession[] {
  const seen = new Set<string>();
  return (Array.isArray(client.sessions) ? client.sessions : [])
    .map((session, originalIndex) => ({ session, originalIndex }))
    .filter(({ session }) => {
      if (!session || !session.id || !isValidIsoDate(session.date) || session.date > today || !qualifiesAsWorkout(session) || seen.has(session.id)) return false;
      seen.add(session.id);
      return true;
    })
    .sort((a, b) => a.session.date.localeCompare(b.session.date) || a.originalIndex - b.originalIndex);
}

function addAward(awards: Map<string, AchievementAward>, id: string, unlockedAt: string, milestone: string): void {
  if (!awards.has(id)) awards.set(id, { id, unlockedAt, milestone });
}

function validBodyweight(client: Client, today: string): { date: string; kg: number }[] {
  return (Array.isArray(client.bodyweight) ? client.bodyweight : [])
    .filter((item) => item && isValidIsoDate(item.date) && item.date <= today && Number.isFinite(item.kg) && item.kg > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

function liftMilestoneId(name: string): string | null {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/\bbench press\b/.test(normalized)) return "bench-press-milestone";
  if (/\bsquat\b/.test(normalized)) return "squat-milestone";
  if (/\bdeadlift\b/.test(normalized)) return "deadlift-milestone";
  return null;
}

/** Derive unlocked milestones only from valid, saved history; drafts are never passed here. */
export function calculateAchievements(client: Client, today = todayIso()): AchievementAward[] {
  if (!isValidIsoDate(today)) return [];
  const awards = new Map<string, AchievementAward>();
  const sessions = orderedSessions(client, today);
  const workoutTargets = [
    { id: "first-workout", count: 1 },
    { id: "workouts-10", count: 10 },
    { id: "workouts-25", count: 25 },
    { id: "workouts-50", count: 50 },
    { id: "workouts-100", count: 100 },
  ];
  for (const target of workoutTargets) {
    const qualifying = sessions[target.count - 1];
    if (qualifying) addAward(awards, target.id, qualifying.session.date, `${target.count} completed workout${target.count === 1 ? "" : "s"} with working sets.`);
  }

  const bestByExercise = new Map<string, number>();
  let firstRecord: SetEvent | null = null;
  const firstLift = new Map<string, SetEvent>();
  let firstE1rmImprovement: SetEvent | null = null;
  for (const { session } of sessions) {
    for (const exercise of session.exercises) {
      for (const set of workingSets(exercise.sets)) {
        const e1rm = oneRm(set.reps, set.weight, set.rpe);
        if (!Number.isFinite(e1rm) || e1rm <= 0) continue;
        const event = { date: session.date, exercise, set, e1rm };
        if (!firstRecord) firstRecord = event;
        const liftId = liftMilestoneId(exercise.name);
        if (liftId && !firstLift.has(liftId)) firstLift.set(liftId, event);
        const previousBest = bestByExercise.get(exercise.id);
        if (previousBest !== undefined && e1rm > previousBest && !firstE1rmImprovement) firstE1rmImprovement = event;
        if (previousBest === undefined || e1rm > previousBest) bestByExercise.set(exercise.id, e1rm);
      }
    }
  }

  const savedRecords = personalRecords({ ...client, sessions: sessions.map(({ session }) => session) });
  if (firstRecord && savedRecords.some((record) => record.e1rm > 0)) {
    addAward(awards, "first-personal-record", firstRecord.date, setMilestone(firstRecord.exercise, firstRecord.set, firstRecord.e1rm));
  }
  if (firstE1rmImprovement) {
    addAward(awards, "new-estimated-1rm", firstE1rmImprovement.date, setMilestone(firstE1rmImprovement.exercise, firstE1rmImprovement.set, firstE1rmImprovement.e1rm));
  }
  for (const [id, event] of firstLift) addAward(awards, id, event.date, setMilestone(event.exercise, event.set, event.e1rm));

  const workoutsByWeek = new Map<string, OrderedSession[]>();
  for (const ordered of sessions) {
    const key = weekStart(ordered.session.date);
    const inWeek = workoutsByWeek.get(key) ?? [];
    inWeek.push(ordered);
    workoutsByWeek.set(key, inWeek);
  }
  for (const [week, inWeek] of [...workoutsByWeek.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (inWeek.length >= 3) {
      addAward(awards, "three-workouts-one-week", inWeek[2]!.session.date, `Three completed workouts in the ISO week beginning ${week}.`);
      break;
    }
  }

  const weeks = [...workoutsByWeek.keys()].sort();
  for (const target of [{ id: "four-week-streak", count: 4 }, { id: "ten-weeks-consistent", count: 10 }]) {
    let streak = 0;
    let previousWeek = "";
    for (const week of weeks) {
      streak = previousWeek && week === shiftIso(previousWeek, 7) ? streak + 1 : 1;
      previousWeek = week;
      if (streak >= target.count) {
        const qualifyingSession = workoutsByWeek.get(week)?.[0]?.session;
        if (qualifyingSession) {
          addAward(awards, target.id, qualifyingSession.date, `At least one completed workout in each of ${target.count} consecutive ISO calendar weeks.`);
        }
        break;
      }
    }
  }

  const measurements = validBodyweight(client, today);
  const firstMeasurement = measurements[0];
  if (firstMeasurement) {
    addAward(awards, "first-body-measurement", firstMeasurement.date, `First dated bodyweight entry: ${formatKg(firstMeasurement.kg)}.`);
  }

  const trackingDates = [
    ...sessions.map(({ session }) => session.date),
    ...measurements.map((measurement) => measurement.date),
  ].sort();
  const firstTrackingDate = trackingDates[0];
  const thirtyDayDate = firstTrackingDate
    ? trackingDates.find((date) => daysBetween(firstTrackingDate, date) >= 30)
    : undefined;
  if (firstTrackingDate && thirtyDayDate) {
    addAward(awards, "thirty-days-tracking", thirtyDayDate, `Saved workout or bodyweight records span ${daysBetween(firstTrackingDate, thirtyDayDate)} calendar days, starting ${firstTrackingDate}.`);
  }
  return [...awards.values()].sort((a, b) => a.unlockedAt.localeCompare(b.unlockedAt) || a.id.localeCompare(b.id));
}

function emptyLedger(): AchievementLedger {
  return { version: 1, initialized: false, clients: {} };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export type ReadLedgerResult = { ok: true; ledger: AchievementLedger } | { ok: false; error: string };

export function readAchievementLedger(storage: AchievementStorage | null): ReadLedgerResult {
  if (!storage) return { ok: false, error: "Local achievement history is unavailable." };
  try {
    const raw = storage.getItem(ACHIEVEMENT_STORAGE_KEY);
    if (raw == null) return { ok: true, ledger: emptyLedger() };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || typeof parsed.initialized !== "boolean" || !isRecord(parsed.clients)) {
      return { ok: false, error: "Saved achievement history is invalid; badges still reflect the saved training records." };
    }
    const clients: Record<string, ClientLedger> = {};
    for (const [clientId, rawClient] of Object.entries(parsed.clients)) {
      if (!isRecord(rawClient) || !isRecord(rawClient.awards) || !Array.isArray(rawClient.pending)) {
        return { ok: false, error: "Saved achievement history is invalid; badges still reflect the saved training records." };
      }
      const awards: Record<string, StoredAward> = {};
      for (const [id, rawAward] of Object.entries(rawClient.awards)) {
        if (!isRecord(rawAward) || typeof rawAward.unlockedAt !== "string" || typeof rawAward.milestone !== "string" || typeof rawAward.celebrated !== "boolean") {
          return { ok: false, error: "Saved achievement history is invalid; badges still reflect the saved training records." };
        }
        awards[id] = { id, unlockedAt: rawAward.unlockedAt, milestone: rawAward.milestone, celebrated: rawAward.celebrated };
      }
      clients[clientId] = {
        awards,
        pending: rawClient.pending.filter((id): id is string => typeof id === "string" && !!awards[id] && !awards[id]?.celebrated),
      };
    }
    return { ok: true, ledger: { version: 1, initialized: parsed.initialized, clients } };
  } catch {
    return { ok: false, error: "Saved achievement history could not be read; badges still reflect the saved training records." };
  }
}

export type TrackAchievementsResult = { ok: true; changed: boolean; ledger: AchievementLedger } | { ok: false; changed: false; error: string };

export function trackClientAchievements(
  storage: AchievementStorage | null,
  clients: Client[],
  today = todayIso(),
): TrackAchievementsResult {
  const result = readAchievementLedger(storage);
  if (!result.ok || !storage) return { ok: false, changed: false, error: result.ok ? "Local achievement history is unavailable." : result.error };
  const ledger = result.ledger;
  const initializing = !ledger.initialized;
  let changed = false;
  for (const client of clients) {
    const current = calculateAchievements(client, today);
    const existing = ledger.clients[client.id];
    if (!existing) {
      // Existing histories and imported records establish a silent baseline.
      const baseline = initializing || current.length > 0;
      const awards: Record<string, StoredAward> = {};
      for (const award of current) awards[award.id] = { ...award, celebrated: baseline };
      ledger.clients[client.id] = { awards, pending: [] };
      changed = true;
      continue;
    }
    for (const award of current) {
      if (existing.awards[award.id]) continue;
      existing.awards[award.id] = { ...award, celebrated: false };
      existing.pending.push(award.id);
      changed = true;
    }
  }
  if (initializing) {
    ledger.initialized = true;
    changed = true;
  }
  if (changed) {
    try { storage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(ledger)); }
    catch { return { ok: false, changed: false, error: "Achievement history could not be saved. Badges still reflect the saved training records." }; }
  }
  return { ok: true, changed, ledger };
}

export type MarkCelebratedResult = { ok: true; ledger: AchievementLedger } | { ok: false; error: string };

export function markAchievementsCelebrated(
  storage: AchievementStorage | null,
  clientId: string,
  ids: string[],
): MarkCelebratedResult {
  const result = readAchievementLedger(storage);
  if (!result.ok || !storage) return { ok: false, error: result.ok ? "Local achievement history is unavailable." : result.error };
  const entry = result.ledger.clients[clientId];
  if (!entry) return { ok: false, error: "Achievement history is not initialized for this client yet." };
  const celebrate = new Set(ids);
  entry.pending = entry.pending.filter((id) => !celebrate.has(id));
  for (const id of celebrate) {
    const award = entry.awards[id];
    if (award) award.celebrated = true;
  }
  try {
    storage.setItem(ACHIEVEMENT_STORAGE_KEY, JSON.stringify(result.ledger));
    return { ok: true, ledger: result.ledger };
  } catch {
    return { ok: false, error: "Achievement celebration history could not be saved; this celebration may appear again." };
  }
}
