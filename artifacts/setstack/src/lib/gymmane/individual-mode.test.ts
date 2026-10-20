// TEST DATA ONLY. These fixtures are isolated from any user's local workspace.
import assert from "node:assert/strict";
import test from "node:test";
import { kExercises } from "./catalog.ts";
import {
  getIndividualOverview,
  getPersonalRecordEvents,
  getStrengthSeries,
  getTrainingTrend,
} from "./individual-analytics.ts";
import { DEFAULT_APPEARANCE } from "./appearance.ts";
import { INDIVIDUAL_PROFILE_ID, individualWorkoutOwner, type Client, type Routine, type SessionLog, type WorkoutOwner } from "./models.ts";
import { useFloor } from "./store.ts";

const today = "2026-10-19";
const bench = kExercises.find((exercise) => /bench press/i.test(exercise.name))!;
const row = kExercises.find((exercise) => /bent over row/i.test(exercise.name))!;

function session(id: string, date: string, exerciseId: string, exerciseName: string, primary: string, sets: SessionLog["exercises"][number]["sets"]): SessionLog {
  return {
    id, date, durationSec: 1200, name: "TEST session", routineId: null,
    exercises: [{ id: exerciseId, name: exerciseName, primary, equipment: "TEST", sets }],
  };
}

function owner(sessions: SessionLog[]): WorkoutOwner {
  return { id: INDIVIDUAL_PROFILE_ID, name: "My training", restSeconds: 90, routines: [], sessions };
}

function testClient(): Client {
  return {
    id: "trainer-client-test", name: "TEST client", sex: "female", age: 30, heightCm: 170,
    weightKg: 65, activity: 1.5, weeklyGoal: 3, neckCm: null, waistCm: null, hipCm: null,
    notes: "", restSeconds: 90, since: today, sessions: [], routines: [], weeklyPlan: {}, bodyweight: [],
  };
}

function resetStore(client = testClient()) {
  useFloor.setState({
    clients: [client],
    trainingMode: "trainer",
    individualProfile: { restSeconds: 90, sessions: [], plans: [] },
    draft: null,
    custom: [],
    templates: [],
    unit: "kg",
    appearance: DEFAULT_APPEARANCE,
    notice: null,
  });
}

test("TEST individual analytics use completed working sets and inclusive date ranges", () => {
  const workouts = owner([
    session("bench-old", "2026-09-30", bench.id, bench.name, bench.primary, [
      { id: "old-work", reps: 5, weight: 70, kind: "normal", rpe: 8 },
      { id: "old-warmup", reps: 10, weight: 40, kind: "warmup", rpe: null },
    ]),
    session("row-recent", "2026-10-12", row.id, row.name, row.primary, [
      { id: "boundary", reps: 8, weight: 50, kind: "normal", rpe: null },
    ]),
    session("bench-today", today, bench.id, bench.name, bench.primary, [
      { id: "today-work", reps: 5, weight: 80, kind: "normal", rpe: 8 },
      { id: "today-warmup", reps: 8, weight: 30, kind: "warmup", rpe: null },
    ]),
    session("future", "2026-10-20", row.id, row.name, row.primary, [
      { id: "future-work", reps: 8, weight: 50, kind: "normal", rpe: null },
    ]),
  ]);

  const seven = getIndividualOverview(workouts, 7, today);
  const thirty = getIndividualOverview(workouts, 30, today);
  assert.deepEqual([seven.workouts, seven.workingSets, seven.volumeKg], [1, 1, 400]);
  assert.deepEqual([thirty.workouts, thirty.workingSets, thirty.volumeKg], [3, 3, 1150]);
  assert.equal(seven.from, "2026-10-13");
  assert.equal(thirty.from, "2026-09-20");
  assert.equal(getStrengthSeries(workouts, bench.id, 7, today).length, 1);
  assert.equal(getStrengthSeries(workouts, bench.id, 30, today).length, 2);
  assert.equal(getIndividualOverview(owner([]), 30, today).workouts, 0);
  assert.deepEqual(getPersonalRecordEvents(owner([]), today), []);
});

test("TEST muscle-filtered trends retain direct/indirect weighting and do not misattribute load volume", () => {
  const workouts = owner([
    session("bench", today, bench.id, bench.name, bench.primary, [
      { id: "work", reps: 5, weight: 80, kind: "normal", rpe: 8 },
      { id: "warmup", reps: 10, weight: 35, kind: "warmup", rpe: null },
    ]),
  ]);
  const chest = getTrainingTrend(workouts, 7, today, { kind: "muscle", muscleId: "chest" }, kExercises).at(-1)!;
  const frontDelts = getTrainingTrend(workouts, 7, today, { kind: "muscle", muscleId: "front-deltoids" }, kExercises).at(-1)!;
  assert.equal(chest.effectiveSets, 1);
  assert.equal(chest.volumeKg, 400);
  assert.equal(frontDelts.effectiveSets, 0.5);
  assert.equal(frontDelts.volumeKg, 0, "secondary volume is not mislabelled as primary-muscle tonnage");
});

test("TEST personal sessions remain separate from client records and survive a store reload", async () => {
  const client = testClient();
  resetStore(client);
  const beforeClientSessions = structuredClone(useFloor.getState().clients[0].sessions);
  assert.equal(useFloor.getState().addClient({ ...testClient(), id: INDIVIDUAL_PROFILE_ID }), false);
  assert.equal(useFloor.getState().clients.length, 1, "the reserved personal owner cannot become a trainer client");
  const start = useFloor.getState().startSession;
  start(INDIVIDUAL_PROFILE_ID, null);
  const exercise = bench;
  useFloor.getState().addDraftExercise(exercise);
  useFloor.getState().logSet({ reps: 5, weight: 80, kind: "normal", rpe: 8 });
  assert.equal(useFloor.getState().finishSession(), INDIVIDUAL_PROFILE_ID);
  const saved = useFloor.getState();
  assert.equal(saved.clients.length, 1);
  assert.deepEqual(saved.clients[0].sessions, beforeClientSessions);
  assert.equal(saved.individualProfile.sessions.length, 1);
  assert.equal(saved.trainingMode, "trainer", "logging does not alter the selected mode");

  saved.setTrainingMode("individual");
  const backup = saved.exportBackup();
  assert.equal(saved.previewBackup(backup).ok, true);
  await useFloor.persist.rehydrate();
  const reloaded = useFloor.getState();
  assert.equal(reloaded.trainingMode, "individual");
  assert.equal(reloaded.individualProfile.sessions.length, 1);
  assert.equal(reloaded.clients[0].sessions.length, 0);
  assert.equal(individualWorkoutOwner(reloaded.individualProfile).id, INDIVIDUAL_PROFILE_ID);
  resetStore();
});

test("TEST saved personal history can be edited and deleted without touching trainer sessions", () => {
  const client = testClient();
  client.sessions = [session("trainer-session", today, row.id, row.name, row.primary, [
    { id: "trainer-set", reps: 8, weight: 40, kind: "normal", rpe: null },
  ])];
  resetStore(client);
  const personal = session("personal-session", today, bench.id, bench.name, bench.primary, [
    { id: "personal-set", reps: 5, weight: 80, kind: "normal", rpe: 8 },
  ]);
  useFloor.setState({ individualProfile: { restSeconds: 90, sessions: [personal] } });
  const edited = structuredClone(personal);
  edited.exercises[0].sets[0].reps = 6;
  assert.equal(useFloor.getState().updateSession(INDIVIDUAL_PROFILE_ID, edited), true);
  useFloor.getState().deleteSession(INDIVIDUAL_PROFILE_ID, personal.id);
  assert.equal(useFloor.getState().individualProfile.sessions.length, 0);
  assert.equal(useFloor.getState().clients[0].sessions[0].id, "trainer-session");
  resetStore();
});

test("TEST switching modes preserves an unfinished personal workout and its logged inputs", () => {
  resetStore();
  useFloor.getState().setTrainingMode("individual");
  useFloor.getState().startSession(INDIVIDUAL_PROFILE_ID, null);
  const exercise = bench;
  useFloor.getState().addDraftExercise(exercise);
  useFloor.getState().logSet({ reps: 5, weight: 80, kind: "normal", rpe: 8 });
  useFloor.getState().setTrainingMode("trainer");
  const retained = useFloor.getState().draft;
  assert.equal(retained?.clientId, INDIVIDUAL_PROFILE_ID);
  assert.equal(retained?.exercises[0].sets[0].weight, 80);
  assert.equal(useFloor.getState().individualProfile.sessions.length, 0, "unfinished work is not falsely marked completed");
  useFloor.getState().setTrainingMode("individual");
  assert.equal(useFloor.getState().draft?.clientId, INDIVIDUAL_PROFILE_ID);
  assert.equal(useFloor.getState().clients[0].sessions.length, 0);
  resetStore();
});

test("TEST personal plans preload ordered exercises, save separately, and survive completion/deletion", async () => {
  const client = testClient();
  client.routines = [{
    id: "trainer-plan", name: "TEST client plan", group: "Client", exerciseIds: [row.id],
    sets: { [row.id]: 2 }, plan: {}, rest: {},
  }];
  resetStore(client);
  const plan: Routine = {
    id: "personal-plan", name: "TEST Push Day", group: "Personal",
    exerciseIds: [bench.id, row.id],
    sets: { [bench.id]: 3, [row.id]: 2 },
    plan: { [bench.id]: [{ reps: 8, weightKg: null, kind: "normal" }] },
    rest: { [bench.id]: 75 },
  };
  assert.equal(useFloor.getState().saveIndividualPlan(plan), true);
  assert.deepEqual(individualWorkoutOwner(useFloor.getState().individualProfile).routines.map((item) => item.id), ["personal-plan"]);
  assert.deepEqual(useFloor.getState().clients[0].routines.map((item) => item.id), ["trainer-plan"]);

  useFloor.getState().startSession(INDIVIDUAL_PROFILE_ID, plan.id);
  const draft = useFloor.getState().draft!;
  assert.equal(draft.routineId, plan.id);
  assert.equal(draft.name, plan.name);
  assert.deepEqual(draft.exercises.map((exercise) => exercise.id), [bench.id, row.id]);
  assert.deepEqual(useFloor.getState().individualProfile.plans?.[0], plan);
  useFloor.getState().logSet({ reps: 8, weight: 60, kind: "normal", rpe: null });
  useFloor.getState().setActive(1);
  useFloor.getState().logSet({ reps: 10, weight: 35, kind: "normal", rpe: null });
  assert.deepEqual(useFloor.getState().individualProfile.plans?.[0], plan, "live set logging does not update the saved plan");
  assert.equal(useFloor.getState().finishSession(), INDIVIDUAL_PROFILE_ID);
  assert.deepEqual(useFloor.getState().individualProfile.sessions[0].exercises.map((exercise) => exercise.id), [bench.id, row.id]);
  assert.equal(useFloor.getState().clients[0].sessions.length, 0);
  await useFloor.persist.rehydrate();
  assert.deepEqual(useFloor.getState().individualProfile.plans?.[0], plan, "saved plans survive store rehydration");
  assert.equal(useFloor.getState().individualProfile.sessions.length, 1);
  assert.equal(useFloor.getState().deleteIndividualPlan(plan.id), true);
  assert.equal(useFloor.getState().individualProfile.plans?.length, 0);
  assert.equal(useFloor.getState().individualProfile.sessions.length, 1, "deleting a reusable plan keeps completed workout history");

  const backup = useFloor.getState().previewBackup(useFloor.getState().exportBackup());
  assert.equal(backup.ok, true);
  resetStore();
});

test("TEST individual weekly schedule distinguishes workouts, rest days, and unscheduled days; persists separately", async () => {
  const client = testClient();
  client.routines = [{
    id: "trainer-plan", name: "TEST client plan", group: "Client", exerciseIds: [row.id],
    sets: { [row.id]: 2 }, plan: {}, rest: {},
  }];
  resetStore(client);
  const plan: Routine = {
    id: "personal-week-plan", name: "TEST Push", group: "Personal", exerciseIds: [bench.id],
    sets: { [bench.id]: 3 }, plan: { [bench.id]: [{ reps: 8, weightKg: 50, kind: "normal" }] },
    rest: { [bench.id]: 90 },
  };
  assert.equal(useFloor.getState().saveIndividualPlan(plan), true);
  const setDay = useFloor.getState().setIndividualScheduleDay;
  assert.equal(setDay(1, { kind: "workout", routineId: plan.id }), true);
  assert.equal(setDay(2, { kind: "workout", routineId: plan.id }), true, "A plan can be assigned to multiple days");
  assert.equal(setDay(3, { kind: "rest" }), true);
  assert.equal(setDay(4, null), true);
  assert.equal(setDay(0 as 1, { kind: "rest" }), false, "Invalid weekdays are rejected");
  assert.equal(setDay(5, { kind: "workout", routineId: "missing-plan" }), false, "Missing personal plans cannot be scheduled");
  assert.equal(setDay(5, { kind: "invalid" } as never), false, "Unsupported schedule entries are rejected");

  let profile = useFloor.getState().individualProfile;
  assert.deepEqual(profile.weeklySchedule, {
    1: { kind: "workout", routineId: plan.id },
    2: { kind: "workout", routineId: plan.id },
    3: { kind: "rest" },
  });
  assert.deepEqual(useFloor.getState().clients[0].routines.map((routine) => routine.id), ["trainer-plan"]);
  assert.equal(profile.sessions.length, 0);

  await useFloor.persist.rehydrate();
  profile = useFloor.getState().individualProfile;
  assert.deepEqual(profile.weeklySchedule, {
    1: { kind: "workout", routineId: plan.id },
    2: { kind: "workout", routineId: plan.id },
    3: { kind: "rest" },
  }, "Schedule persists after a store rehydration");

  assert.equal(useFloor.getState().deleteIndividualPlan(plan.id), true);
  assert.deepEqual(useFloor.getState().individualProfile.weeklySchedule, { 3: { kind: "rest" } },
    "Removing a plan clears only days assigned to that plan and keeps rest days");
  assert.deepEqual(useFloor.getState().clients[0].routines.map((routine) => routine.id), ["trainer-plan"]);
  resetStore();
});
