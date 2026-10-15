// TEST DATA ONLY. Isolated Node stores; no browser/device or user data.
import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "zustand/vanilla";
import { durablePersist, getPersistenceHealth, PersistenceFailure } from "./durable-persistence.ts";
import { useFloor } from "./store.ts";
import { encodeBackup, inspectBackup, validateSavedFloor, type SavedFloor } from "./backup.ts";
import { seedClients } from "./seed.ts";
import { DEFAULT_APPEARANCE } from "./appearance.ts";

function fixture(): SavedFloor {
  return { clients: seedClients().map((c, i) => ({ ...c, name: `TEST Client ${i}` })), custom: [], templates: [], draft: null, unit: "kg", appearance: DEFAULT_APPEARANCE };
}
function reject(data: unknown, pattern: RegExp) {
  const result = inspectBackup(JSON.stringify(data), fixture());
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, pattern);
}
test("TEST full nested validation rejects malformed and incompatible backups without filtering", () => {
  reject({ clients: [{ id: "test", name: "TEST", sex: "female", routines: [], sessions: [] }] }, /Unsupported/);
  reject({ app: "OtherApp", version: 2, ...fixture() }, /Unsupported/);
  reject({ app: "SetStack", version: 3, ...fixture() }, /Unsupported/);
  reject({ app: "SetStack", version: 2, ...fixture(), custom: null }, /list/);
  reject({ app: "SetStack", version: 1, clients: fixture().clients, templates: null }, /list/);
  for (const field of ["clients", "custom", "templates", "unit", "draft"]) {
    const data: Record<string, unknown> = { app: "SetStack", version: 2, ...fixture() };
    delete data[field];
    reject(data, /missing/);
  }
  const mutations: [string, (data: SavedFloor) => void][] = [
    ["duplicate clients", (d) => { d.clients.push(d.clients[0]); }],
    ["missing weekly plan", (d) => { delete (d.clients[0] as Partial<typeof d.clients[0]>).weeklyPlan; }],
    ["invalid measurement", (d) => { d.clients[0].bodyweight[0].kg = -1; }],
    ["impossible date", (d) => { d.clients[0].sessions[0].date = "2026-02-30"; }],
    ["invalid set", (d) => { d.clients[0].sessions[0].exercises[0].sets[0].weight = -1; }],
    ["duplicate sessions", (d) => { d.clients[0].sessions.push(d.clients[0].sessions[0]); }],
    ["duplicate set ids", (d) => { const e = d.clients[0].sessions[0].exercises[0]; e.sets.push(e.sets[0]); }],
    ["invalid assignment", (d) => { d.clients[0].weeklyPlan["1"] = "does-not-exist"; }],
    ["unknown routine exercise", (d) => { d.clients[0].routines[0].exerciseIds.push("unavailable"); }],
    ["unsafe identifier", (d) => { d.clients[0].id = "__proto__"; }],
  ];
  for (const [name, mutate] of mutations) {
    const data = fixture();
    mutate(data);
    const result = inspectBackup(encodeBackup(data), fixture());
    assert.equal(result.ok, false, name);
  }
});
test("TEST version 2 roundtrip preserves exact loads, pending draft and units", () => {
  useFloor.setState(fixture());
  const client = useFloor.getState().clients[0];
  useFloor.getState().startSession(client.id, client.routines[0].id);
  const exerciseId = useFloor.getState().draft!.exercises[0].id;
  useFloor.getState().setDraftEntry(exerciseId, { reps: 8, weightKg: 60.625, rir: 2, kind: "normal" });
  useFloor.getState().setUnit("lb");
  const backup = useFloor.getState().exportBackup();
  const before = JSON.parse(backup);
  const result = useFloor.getState().previewBackup(backup);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.preview.hasDraft, true);
    assert.equal(result.preview.data.draft!.entries![exerciseId].weightKg, 60.625);
    assert.equal(result.preview.data.unit, "lb");
  }
  useFloor.setState(fixture());
  assert.equal(useFloor.getState().importBackup(backup), "");
  assert.deepEqual(JSON.parse(useFloor.getState().exportBackup()), before);
});
test("TEST legacy upgrades add only documented optional fields and preserve current units", () => {
  const data = fixture();
  const old = structuredClone(data.clients);
  for (const c of old) for (const r of c.routines) {
    delete (r as Partial<typeof r>).plan;
    delete (r as Partial<typeof r>).rest;
  }
  const current = { ...fixture(), unit: "lb" as const };
  const input = JSON.stringify({ app: "SetStack", version: 1, clients: old, custom: [] });
  const result = inspectBackup(input, current);
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.preview.data.unit, "lb");
    assert.equal(result.preview.data.draft, null);
    assert.equal(result.preview.data.clients[0].sessions.length, old[0].sessions.length);
    assert.deepEqual(result.preview.data.clients[0].routines[0].plan, {});
  }
  assert.ok(inspectBackup(JSON.stringify(old), current).ok);
});
test("TEST incomplete or out-of-range pending input survives backup without becoming a logged set", () => {
  useFloor.setState(fixture());
  const c = useFloor.getState().clients[0];
  useFloor.getState().startSession(c.id, c.routines[0].id);
  const id = useFloor.getState().draft!.exercises[0].id;
  const entry = { weightKg: 60.625, reps: null, rir: null, kind: "normal" as const,
    inputs: { weight: "60.625", reps: "1.5", rir: "12", unit: "kg" as const } };
  useFloor.getState().setDraftEntry(id, entry);
  const result = useFloor.getState().previewBackup(useFloor.getState().exportBackup());
  assert.ok(result.ok);
  if (result.ok) {
    assert.deepEqual(result.preview.data.draft!.entries![id], entry);
    assert.equal(result.preview.data.draft!.exercises[0].sets.length, 0);
  }
  const bad = JSON.parse(useFloor.getState().exportBackup());
  bad.draft.entries[id].weightKg = -1;
  reject(bad, /numeric/);
  bad.draft.entries[id].weightKg = 60.625;
  bad.draft.entries[id].inputs.weight = "-1";
  reject(bad, /does not match/);
});
test("TEST empty workspace is a valid portable backup; previews never mutate input", () => {
  const empty: SavedFloor = { clients: [], custom: [], templates: [], unit: "kg", draft: null, appearance: DEFAULT_APPEARANCE };
  assert.ok(inspectBackup(encodeBackup(empty), fixture()).ok);
  const data = fixture();
  const before = JSON.stringify(data);
  validateSavedFloor(data);
  inspectBackup(encodeBackup(data), data);
  assert.equal(JSON.stringify(data), before);
});
test("TEST invalid restore and interrupted checkpoint/main writes leave active records untouched", () => {
  useFloor.setState(fixture());
  const options = useFloor.persist.getOptions();
  const originalStorage = options.storage;
  const stateBefore = useFloor.getState().exportBackup();
  const envelope = { state: fixture(), version: 0 };
  const values = new Map<string, typeof envelope>([["setstack-v1", envelope]]);
  let failAt: string | null = null;
  let writes = 0;
  useFloor.persist.setOptions({ storage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      writes++;
      if (key === failAt) throw new Error("TEST interrupted write");
      values.set(key, structuredClone(value) as typeof envelope);
    },
    removeItem: (key) => { values.delete(key); },
  } });
  try {
    assert.notEqual(useFloor.getState().importBackup('{"app":"SetStack","version":2,"clients":[]}'), "");
    assert.equal(writes, 0);
    for (const key of ["setstack-v1.before-restore", "setstack-v1"]) {
      failAt = key;
      assert.match(useFloor.getState().importBackup(encodeBackup({ ...fixture(), clients: [] })), /not applied/);
      assert.equal(useFloor.getState().exportBackup(), stateBefore);
      assert.deepEqual(values.get("setstack-v1"), envelope);
    }
    failAt = null;
    assert.equal(useFloor.getState().importBackup(encodeBackup({ ...fixture(), clients: [] })), "");
    assert.equal(useFloor.getState().clients.length, 0);
    assert.deepEqual(values.get("setstack-v1.before-restore"), envelope);
  } finally {
    useFloor.persist.setOptions({ storage: originalStorage });
    useFloor.setState(fixture());
  }
});
test("TEST write-before-memory ordering, single write and explicit failed-save state", () => {
  let committed = 1;
  let fail = false;
  let writes = 0;
  const store = createStore(durablePersist<{ count: number }, { count: number }>(() => ({ count: 1 }), {
    name: "TEST-only", skipHydration: true,
    storage: {
      getItem: () => ({ state: { count: committed }, version: 0 }),
      setItem: (_key, value) => { writes++; if (fail) throw new Error("TEST quota"); committed = value.state.count; },
      removeItem: () => {},
    },
    partialize: (s) => ({ count: s.count }),
  }));
  store.subscribe((state) => assert.equal(committed, state.count, "subscribers see only durable state"));
  store.setState({ count: 2 });
  assert.equal(writes, 1);
  fail = true;
  assert.throws(() => store.setState({ count: 3 }), PersistenceFailure);
  assert.equal(store.getState().count, 2);
  assert.equal(committed, 2);
  assert.equal(getPersistenceHealth().phase, "write-error");
  fail = false;
  store.setState({ count: 3 });
  assert.equal(getPersistenceHealth().phase, "ready");
});
test("TEST hydration errors reject, cannot overwrite unreadable data, and can retry safely", async () => {
  let failRead = true;
  let writes = 0;
  const store = createStore(durablePersist<{ count: number }, { count: number }>(() => ({ count: 0 }), {
    name: "TEST-only", skipHydration: true,
    storage: {
      getItem: () => { if (failRead) throw new Error("TEST corrupt JSON"); return { state: { count: 42 }, version: 0 }; },
      setItem: () => { writes++; },
      removeItem: () => {},
    },
  }));
  await assert.rejects(store.persist.rehydrate(), /corrupt/);
  assert.equal(store.persist.hasHydrated(), false);
  assert.equal(store.getState().count, 0);
  assert.throws(() => store.setState({ count: 1 }), /not been safely loaded/);
  assert.throws(() => store.setState({ count: 2 }), /not been safely loaded/);
  assert.equal(writes, 0);
  failRead = false;
  await store.persist.rehydrate();
  assert.equal(store.getState().count, 42);
  assert.equal(store.persist.hasHydrated(), true);
  assert.equal(writes, 0, "hydration never writes or migrates original bytes");
});
test("TEST incompatible stored version rejects without migration or overwriting", async () => {
  let writes = 0;
  const store = createStore(durablePersist<{ count: number }, { count: number }>(() => ({ count: 0 }), {
    name: "TEST-only", skipHydration: true,
    storage: { getItem: () => ({ state: { count: 42 }, version: 9 }), setItem: () => { writes++; }, removeItem: () => {} },
  }));
  await assert.rejects(store.persist.rehydrate(), /Incompatible/);
  assert.equal(writes, 0);
  assert.equal(store.getState().count, 0);
});
test("TEST large history validation/roundtrip preserves all records", () => {
  const data = fixture();
  const client = data.clients[0];
  const sample = client.sessions[0];
  client.sessions = Array.from({ length: 5000 }, (_, i) => ({ ...structuredClone(sample), id: `TEST-session-${i}` }));
  const result = inspectBackup(encodeBackup(data), fixture());
  assert.ok(result.ok);
  if (result.ok) assert.deepEqual(result.preview.data.clients[0].sessions, client.sessions);
});
