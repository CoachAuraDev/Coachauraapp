import assert from "node:assert/strict";
import test from "node:test";
import { useFloor } from "./store.ts";

// An isolated Node store and TEST fixture only; never accesses browser data.
test("CoachAura rename preserves legacy persisted clients, programs, workouts, progress and draft", async () => {
  const client = { ...useFloor.getState().clients[0], name: "TEST Legacy Stored Client" };
  useFloor.setState({ clients: [client], custom: [], draft: null, unit: "lb" });
  useFloor.getState().addCustom("TEST Legacy Custom Exercise", "biceps", ["forearms"]);
  useFloor.getState().startSession(client.id, client.routines[0]?.id ?? null);
  useFloor.getState().logSet({ reps: 8, weight: 40, kind: "normal", rpe: 8 });
  const state = useFloor.getState();
  const historical = JSON.parse(JSON.stringify({
    clients: state.clients, custom: state.custom, unit: state.unit, draft: state.draft,
  }));
  assert.ok(historical.clients[0].sessions.length > 0);
  assert.ok(historical.clients[0].routines.length > 0);
  assert.ok(historical.clients[0].bodyweight.length > 0);
  assert.ok(historical.draft);
  assert.equal(useFloor.persist.getOptions().name, "setstack-v1");

  useFloor.setState({ clients: [], custom: [], draft: null, unit: "kg" });
  const storage = new Map([["setstack-v1", JSON.stringify({ state: historical, version: 0 })]]);
  const previousStorage = useFloor.persist.getOptions().storage;
  useFloor.persist.setOptions({
    storage: {
      getItem: (key) => storage.has(key) ? JSON.parse(storage.get(key)!) : null,
      setItem: (key, value) => { storage.set(key, JSON.stringify(value)); },
      removeItem: (key) => { storage.delete(key); },
    },
  });
  try {
    await useFloor.persist.rehydrate();
    const restored = useFloor.getState();
    assert.deepEqual(restored.clients, historical.clients);
    assert.deepEqual(restored.custom, historical.custom);
    assert.deepEqual(restored.draft, historical.draft);
    assert.equal(restored.unit, "lb");
    // This marker is an internal format identifier, not UI branding.
    const backup = JSON.parse(restored.exportBackup());
    assert.equal(backup.app, "SetStack");
    assert.equal(backup.version, 3);
    assert.deepEqual(backup.clients, historical.clients);
    assert.deepEqual(backup.custom, historical.custom);
    assert.equal(restored.importBackup(JSON.stringify(backup)), "");
    assert.deepEqual(useFloor.getState().clients, historical.clients);
    assert.deepEqual(useFloor.getState().custom, historical.custom);
  } finally {
    useFloor.persist.setOptions({ storage: previousStorage });
  }
});
