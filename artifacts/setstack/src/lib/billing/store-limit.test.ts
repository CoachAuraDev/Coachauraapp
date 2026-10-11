import assert from "node:assert/strict";
import test from "node:test";
import { seedClients } from "../gymmane/seed.ts";
import { useFloor } from "../gymmane/store.ts";
import { setBillingAccessSource } from "./access.ts";

test("the persisted client-creation action rejects client four without changing the first three", async () => {
  const [sample] = seedClients();
  assert.ok(sample);
  setBillingAccessSource(null);
  useFloor.setState({ clients: [0, 1].map((index) => ({ ...sample, id: `free-${index}` })) });

  assert.equal(useFloor.getState().addClient({ ...sample, id: "free-third" }), true);
  assert.equal(useFloor.getState().clients.length, 3);
  const existing = useFloor.getState().clients;
  assert.equal(useFloor.getState().addClient({ ...sample, id: "free-fourth" }), false);
  assert.equal(useFloor.getState().clients, existing);

  await useFloor.persist.rehydrate();
  assert.equal(useFloor.getState().clients.length, 3);
  assert.deepEqual(useFloor.getState().clients.map((client) => client.id), [
    "free-third",
    "free-0",
    "free-1",
  ]);
});

test("a live purchase entitlement permits additional clients without changing existing profiles", () => {
  const [sample] = seedClients();
  assert.ok(sample);
  setBillingAccessSource("play");
  useFloor.setState({ clients: [0, 1, 2].map((index) => ({ ...sample, id: `paid-${index}` })) });

  assert.equal(useFloor.getState().addClient({ ...sample, id: "paid-fourth" }), true);
  assert.deepEqual(useFloor.getState().clients.map((client) => client.id), [
    "paid-fourth",
    "paid-0",
    "paid-1",
    "paid-2",
  ]);
  setBillingAccessSource(null);
});
