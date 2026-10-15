// TEST DATA ONLY: isolated Node store, never user browser storage.
import test from "node:test";
import assert from "node:assert/strict";
import { useFloor } from "./store.ts";
import { kExercises } from "./catalog.ts";
import { nextSetDefaults, previousExercisePerformance, plannedSetCount } from "./workout-logging.ts";
import { fromDisplay, toDisplay } from "./engine.ts";
import { personalRecords } from "./metrics.ts";
import type { Client, Routine, SessionLog, SetLog } from "./models.ts";

const bench = kExercises.find((exercise) => exercise.name === "Barbell Bench Press")!;
const row = kExercises.find((exercise) => exercise.name === "Barbell Bent Over Row")!;
function entry(id: string, weight = 50, reps = 8, kind: SetLog["kind"] = "normal"): SetLog {
  return { id, weight, reps, kind, rpe: 8 };
}
function session(id: string, date: string, sets: SetLog[]): SessionLog {
  return { id, date, name: "TEST Workout", routineId: null, durationSec: 1200,
    exercises: [{ id: bench.id, name: bench.name, primary: bench.primary, equipment: bench.equipment, sets }] };
}
function client(id: string, sessions: SessionLog[] = []): Client {
  return { id, name: `TEST ${id}`, sex: "female", age: 30, heightCm: 170, weightKg: 65,
    activity: 1.5, weeklyGoal: 3, neckCm: null, waistCm: null, hipCm: null, notes: "",
    restSeconds: 90, since: "2025-01-01", sessions, routines: [], weeklyPlan: {}, bodyweight: [] };
}
function routine(): Routine {
  return { id: "TEST-template", name: "TEST Upper", group: "TEST", exerciseIds: [row.id, bench.id],
    sets: { [bench.id]: 2, [row.id]: 3 },
    plan: { [bench.id]: [{ reps: 10, weightKg: null, kind: "normal" }, { reps: 6, weightKg: 60, kind: "normal" }] },
    rest: { [bench.id]: 120, [row.id]: 60 } };
}
function reset(clients = [client("A"), client("B")]) {
  useFloor.setState({ clients, templates: [], custom: [], draft: null, notice: null, unit: "kg" });
  return useFloor.getState();
}

test("latest working performance is chronological, same-day stable, client isolated and copied", () => {
  const c = client("A", [
    session("new", "2025-02-02", [entry("new", 60)]),
    session("old", "2025-01-01", [entry("old", 20)]),
    session("latest", "2025-02-02", [entry("warm", 10, 10, "warmup"), entry("work", 65), entry("zero", 80, 0)]),
    session("warm-only", "2025-03-01", [entry("warm", 10, 10, "warmup")]),
  ]);
  const before = JSON.stringify(c);
  const previous = previousExercisePerformance(c, bench.id)!;
  assert.equal(previous.date, "2025-02-02");
  assert.equal(previous.sets.length, 1);
  assert.equal(previous.sets[0]!.weight, 65);
  previous.sets[0]!.weight = 500;
  assert.equal(JSON.stringify(c), before);
  assert.equal(previousExercisePerformance(client("B"), bench.id), null);
});

test("next-set defaults use corresponding previous sets and assigned targets without filling logged results", () => {
  const c = client("A", [session("old", "2025-02-02", [entry("one", 50, 8), entry("two", 55, 7)])]);
  const exercise = { ...c.sessions[0]!.exercises[0]!, sets: [] as SetLog[] };
  assert.deepEqual(nextSetDefaults(c, undefined, exercise), { weightKg: 50, reps: 8, rir: 2, kind: "normal" });
  exercise.sets.push(entry("current", 52));
  assert.equal(nextSetDefaults(c, undefined, exercise).weightKg, 55);
  assert.equal(nextSetDefaults(c, routine(), exercise).weightKg, 60);
  assert.equal(nextSetDefaults(c, routine(), exercise).reps, 6);
  assert.equal(plannedSetCount(routine(), bench.id), 2);
  assert.equal(plannedSetCount(undefined, bench.id), 0);
  assert.equal(nextSetDefaults(client("empty"), undefined, { ...exercise, sets: [] }).weightKg, 0);
  assert.equal(nextSetDefaults(client("empty"), undefined, { ...exercise, sets: [] }).reps, 8);
  const warmupPlan = routine();
  warmupPlan.plan[bench.id] = [{ kind: "warmup", reps: 12, weightKg: 20 }, { kind: "normal", reps: 8, weightKg: 50 }];
  assert.equal(nextSetDefaults(c, warmupPlan, { ...exercise, sets: [] }).kind, "warmup");
  assert.equal(nextSetDefaults(c, warmupPlan, { ...exercise, sets: [entry("warm", 20, 12, "warmup")] }).kind, "normal");
});

test("templates assign deep independent copies; editing or deleting master does not affect clients or history", () => {
  const old = session("old", "2025-02-02", [entry("old")]);
  const s = reset([client("A", [old]), client("B")]);
  const t = routine();
  s.saveTemplate(t);
  t.plan[bench.id]![0]!.reps = 99;
  assert.equal(useFloor.getState().templates[0]!.plan[bench.id]![0]!.reps, 10);
  s.assignTemplate("A", t.id);
  s.assignTemplate("B", t.id);
  const a = useFloor.getState().clients[0]!.routines[0]!;
  const b = useFloor.getState().clients[1]!.routines[0]!;
  assert.notEqual(a.id, b.id);
  assert.deepEqual(a.exerciseIds, [row.id, bench.id]);
  s.saveRoutine("A", { ...structuredClone(a), name: "TEST Edited", rest: { [bench.id]: 15 } });
  assert.equal(useFloor.getState().clients[1]!.routines[0]!.rest[bench.id], 120);
  s.deleteTemplate(t.id);
  assert.equal(useFloor.getState().templates.length, 0);
  assert.equal(useFloor.getState().clients[0]!.routines.length, 1);
  assert.deepEqual(useFloor.getState().clients[0]!.sessions[0], old);
});

test("draft guard preserves logged and pending sets; restart restores entries, timer and templates in legacy storage", async () => {
  const s = reset();
  s.saveTemplate(routine());
  s.startSession("A", null);
  s.addDraftExercise(bench);
  s.logSet(entry("ignored"));
  s.setDraftEntry(bench.id, { weightKg: 62.5, reps: 7, rir: 1, kind: "normal" });
  s.configureRest(75, true, true);
  s.startRest();
  const before = structuredClone(useFloor.getState().draft);
  s.startSession("B", null);
  assert.deepEqual(useFloor.getState().draft, before);
  const persisted = useFloor.persist.getOptions().partialize!(useFloor.getState());
  const priorStorage = useFloor.persist.getOptions().storage;
  let saved = { state: structuredClone(persisted), version: 0 };
  useFloor.setState({ clients: [], draft: null, templates: [] });
  useFloor.persist.setOptions({ storage: {
    getItem: () => saved,
    setItem: (_, value) => { saved = structuredClone(value) as typeof saved; },
    removeItem: () => {},
  } });
  try {
    await useFloor.persist.rehydrate();
    assert.deepEqual(useFloor.getState().draft, before);
    assert.deepEqual(useFloor.getState().templates, [routine()]);
    assert.equal(useFloor.getState().clients.length, 2);
    assert.equal(useFloor.persist.getOptions().name, "setstack-v1");
    const kg = useFloor.getState().draft!.entries![bench.id]!.weightKg!;
    assert.ok(Math.abs(fromDisplay(toDisplay(kg, "lb"), "lb") - kg) < 1e-9);
  } finally { useFloor.persist.setOptions({ storage: priorStorage }); }
});

test("logged and pending loads stay exact across unit changes and draft rehydration", async () => {
  const s = reset();
  s.startSession("A", null);
  s.addDraftExercise(bench);
  s.logSet({ id: "unit-logged", weight: 60.625, reps: 8, rpe: 8, kind: "normal" });
  s.setDraftEntry(bench.id, {
    weightKg: 60.625,
    reps: 5,
    rir: 1,
    kind: "normal",
    inputs: { weight: "60.625", reps: "5", rir: "1", unit: "kg" },
  });

  s.setUnit("lb");
  const pending = useFloor.getState().draft!.entries![bench.id]!;
  assert.equal(useFloor.getState().draft!.exercises[0]!.sets[0]!.weight, 60.625);
  assert.equal(pending.weightKg, 60.625);
  s.setDraftEntry(bench.id, {
    ...pending,
    reps: 6,
    inputs: { ...pending.inputs!, reps: "6" },
  });
  const afterReps = useFloor.getState().draft!.entries![bench.id]!;
  assert.equal(afterReps.weightKg, 60.625, "Changing reps must not reconvert the pending load");
  s.setDraftEntry(bench.id, {
    ...afterReps,
    rir: 0,
    inputs: { ...afterReps.inputs!, rir: "0" },
  });
  const afterRir = useFloor.getState().draft!.entries![bench.id]!;
  assert.equal(afterRir.weightKg, 60.625, "Changing RIR must not reconvert the pending load");
  assert.equal(afterRir.inputs?.unit, "kg", "The saved input text keeps the unit it was entered in");

  const persisted = useFloor.persist.getOptions().partialize!(useFloor.getState());
  const priorStorage = useFloor.persist.getOptions().storage;
  let saved = { state: structuredClone(persisted), version: 0 };
  useFloor.setState({ clients: [], draft: null, templates: [] });
  useFloor.persist.setOptions({ storage: {
    getItem: () => saved,
    setItem: (_, value) => { saved = structuredClone(value) as typeof saved; },
    removeItem: () => {},
  } });
  try {
    await useFloor.persist.rehydrate();
    const restored = useFloor.getState();
    assert.equal(restored.unit, "lb");
    assert.equal(restored.draft!.exercises[0]!.sets[0]!.weight, 60.625);
    assert.equal(restored.draft!.entries![bench.id]!.weightKg, 60.625);
    assert.equal(restored.draft!.entries![bench.id]!.reps, 6);
    assert.equal(restored.draft!.entries![bench.id]!.rir, 0);
  } finally { useFloor.persist.setOptions({ storage: priorStorage }); }
});

test("copied values log into a new workout, draft edit validates, finish preserves previous results", () => {
  const old = session("old", "2025-02-02", [entry("old", 50, 8)]);
  const s = reset([client("A", [old]), client("B")]);
  const before = JSON.stringify(old);
  s.startSession("A", null);
  s.addDraftExercise(bench);
  const copied = previousExercisePerformance(useFloor.getState().clients[0]!, bench.id)!.sets[0]!;
  s.logSet({ ...copied, weight: 55 });
  s.setDraftEntry(bench.id, { weightKg: 65, reps: null, rir: null, kind: "normal" });
  const id = useFloor.getState().draft!.exercises[0]!.sets[0]!.id;
  assert.ok(s.updateDraftSet(0, id, { reps: 9 }));
  assert.equal(s.updateDraftSet(0, id, { weight: NaN }), false);
  assert.equal(s.updateDraftSet(0, id, { reps: 3.5 }), false);
  assert.equal(useFloor.getState().draft!.exercises[0]!.sets[0]!.reps, 9);
  s.finishSession();
  assert.equal(JSON.stringify(useFloor.getState().clients[0]!.sessions[0]), before);
  assert.equal(useFloor.getState().clients[0]!.sessions.length, 2);
  assert.equal(useFloor.getState().clients[1]!.sessions.length, 0);
  assert.equal(useFloor.getState().draft, null);
});

test("assigned rest defaults follow the active exercise without interrupting the current countdown", () => {
  const c = client("A");
  c.routines = [routine()];
  const s = reset([c]);
  s.startSession("A", c.routines[0]!.id);
  assert.equal(useFloor.getState().draft!.restDurationSeconds, 60);
  s.logSet(entry("row"));
  const until = useFloor.getState().draft!.restUntil;
  s.setActive(1);
  assert.equal(useFloor.getState().draft!.restDurationSeconds, 120);
  assert.equal(useFloor.getState().draft!.restUntil, until);
  s.configureRest(75);
  s.setActive(0);
  assert.equal(useFloor.getState().draft!.restDurationSeconds, 75);
});

test("historical editing is isolated and validated, recalculates existing PRs, and preserves a live draft", () => {
  const old = session("old", "2025-02-02", [entry("old", 50, 8)]);
  const s = reset([client("A", [old]), client("B", [structuredClone(old)])]);
  s.startSession("A", null);
  s.addDraftExercise(row);
  s.logSet(entry("live", 20));
  const live = structuredClone(useFloor.getState().draft);
  const edit = structuredClone(old);
  edit.exercises[0]!.sets[0]!.weight = 80;
  assert.ok(s.updateSession("A", edit));
  edit.exercises[0]!.sets[0]!.weight = 999;
  assert.equal(useFloor.getState().clients[0]!.sessions[0]!.exercises[0]!.sets[0]!.weight, 80);
  assert.equal(useFloor.getState().clients[1]!.sessions[0]!.exercises[0]!.sets[0]!.weight, 50);
  assert.ok(personalRecords(useFloor.getState().clients[0]!)[0]!.e1rm > personalRecords(useFloor.getState().clients[1]!)[0]!.e1rm);
  assert.deepEqual(useFloor.getState().draft, live);
  assert.equal(s.updateSession("A", { ...edit, date: "2025-02-31" }), false);
  assert.equal(s.updateSession("A", { ...edit, id: "not-recorded" }), false);
  const legacy = session("legacy", "2025-01-01", [entry("zero", 20, 0)]);
  useFloor.setState({ clients: [client("A", [legacy])] });
  assert.ok(s.updateSession("A", { ...structuredClone(legacy), name: "TEST Rename Legacy" }));
});

test("rest countdown uses deadlines; configurable pause/resume/reset and optional alerts survive store edits", (t) => {
  let clock = 100000;
  t.mock.method(Date, "now", () => clock);
  const s = reset();
  s.startSession("A", null);
  s.addDraftExercise(bench);
  s.configureRest(60, true, true);
  s.logSet(entry("test"));
  assert.equal(useFloor.getState().draft!.restUntil, 160000);
  clock = 115000;
  s.pauseRest();
  assert.equal(useFloor.getState().draft!.restPausedSeconds, 45);
  assert.equal(useFloor.getState().draft!.restUntil, null);
  clock = 150000;
  s.startRest();
  assert.equal(useFloor.getState().draft!.restUntil, 195000);
  s.bumpRest(15);
  assert.equal(useFloor.getState().draft!.restUntil, 210000);
  s.resetRest();
  assert.equal(useFloor.getState().draft!.restUntil, null);
  assert.equal(useFloor.getState().draft!.restPausedSeconds, null);
  assert.equal(useFloor.getState().draft!.restDurationSeconds, 60);
  assert.equal(useFloor.getState().draft!.timerSound, true);
  assert.equal(useFloor.getState().draft!.timerVibration, true);
  s.startRest();
  assert.equal(useFloor.getState().draft!.restUntil, 210000);
  s.skipRest();
  assert.equal(useFloor.getState().draft!.restUntil, null);
});

test("template backups roundtrip and old backups remain compatible; invalid sets are never saved", () => {
  const s = reset();
  s.saveTemplate(routine());
  const raw = s.exportBackup();
  s.deleteTemplate("TEST-template");
  assert.equal(s.importBackup(raw), "");
  assert.deepEqual(useFloor.getState().templates, [routine()]);
  assert.equal(s.importBackup(JSON.stringify({ app: "SetStack", version: 1, clients: [client("legacy")], custom: [] })), "");
  assert.equal(useFloor.getState().clients[0]!.id, "legacy");
  s.startSession("legacy", null);
  s.addDraftExercise(bench);
  for (const invalid of [{ ...entry("bad"), weight: -1 }, { ...entry("bad"), reps: Infinity }, { ...entry("bad"), rpe: 11 }]) s.logSet(invalid);
  assert.equal(useFloor.getState().draft!.exercises[0]!.sets.length, 0);
});
