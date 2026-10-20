// TEST DATA ONLY. Isolated Node store; no browser/device or user data.
import test from "node:test";
import assert from "node:assert/strict";
import { useFloor } from "./store.ts";
import { kExercises } from "./catalog.ts";
import { seedClients } from "./seed.ts";
import { DEFAULT_APPEARANCE } from "./appearance.ts";

test("saved workout warm-up retains its type and exact values through backup restore", () => {
  const client = structuredClone(seedClients()[0]!);
  const exercise = kExercises.find((item) => item.name === "Barbell Bench Press")!;
  useFloor.setState({
    clients: [client],
    custom: [],
    templates: [],
    draft: null,
    unit: "kg",
    appearance: DEFAULT_APPEARANCE,
    trainingMode: "trainer",
    individualProfile: { restSeconds: 90, sessions: [], plans: [], weeklySchedule: {} },
  });

  const store = useFloor.getState();
  store.startSession(client.id, null);
  store.addDraftExercise(exercise);
  store.logSet({ weight: 37.625, reps: 11, rpe: 6, kind: "warmup" });
  assert.equal(store.finishSession(), client.id);

  const savedSession = useFloor.getState().clients[0]!.sessions.at(-1)!;
  const expectedWarmup = structuredClone(savedSession.exercises[0]!.sets[0]!);
  assert.deepEqual(
    { weight: expectedWarmup.weight, reps: expectedWarmup.reps, rpe: expectedWarmup.rpe, kind: expectedWarmup.kind },
    { weight: 37.625, reps: 11, rpe: 6, kind: "warmup" },
  );

  const backup = store.exportBackup();
  const encoded = JSON.parse(backup);
  const backedUpSet = encoded.clients[0].sessions.at(-1).exercises[0].sets[0];
  assert.deepEqual(backedUpSet, expectedWarmup, "Export should retain the complete saved warm-up set");

  const editedSession = structuredClone(savedSession);
  Object.assign(editedSession.exercises[0]!.sets[0]!, {
    weight: 1,
    reps: 1,
    rpe: 1,
    kind: "normal",
  });
  assert.equal(store.updateSession(client.id, editedSession), true);
  assert.equal(useFloor.getState().clients[0]!.sessions.at(-1)!.exercises[0]!.sets[0]!.kind, "normal");

  assert.equal(store.importBackup(backup), "");
  const restoredSet = useFloor.getState().clients[0]!.sessions.at(-1)!.exercises[0]!.sets[0]!;
  assert.deepEqual(restoredSet, expectedWarmup, "Restore should recover the original type and entered values");
});
