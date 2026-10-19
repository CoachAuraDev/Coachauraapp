import assert from "node:assert/strict";
import test from "node:test";
import {
  FIRST_LAUNCH_COMPLETE_KEY,
  markFirstLaunchIntroComplete,
  shouldShowFirstLaunchIntro,
} from "./first-launch.ts";

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    values,
  };
}

test("a fresh installation shows the introduction until completed", () => {
  const storage = memoryStorage();
  assert.equal(shouldShowFirstLaunchIntro(storage), true);
  assert.equal(storage.values.has(FIRST_LAUNCH_COMPLETE_KEY), false);
  assert.equal(markFirstLaunchIntroComplete(storage), true);
  assert.equal(storage.values.get(FIRST_LAUNCH_COMPLETE_KEY), "1");
  assert.equal(shouldShowFirstLaunchIntro(storage), false);
});

test("existing workspace data bypasses and permanently marks the introduction complete", () => {
  const savedWorkspace = JSON.stringify({ state: { clients: [{ id: "existing-client" }] }, version: 0 });
  const storage = memoryStorage({ "setstack-v1": savedWorkspace });
  assert.equal(shouldShowFirstLaunchIntro(storage), false);
  assert.equal(storage.values.get(FIRST_LAUNCH_COMPLETE_KEY), "1");
  assert.equal(storage.values.get("setstack-v1"), savedWorkspace);
});

test("inaccessible storage fails open into the existing app", () => {
  assert.equal(shouldShowFirstLaunchIntro(null), false);
  assert.equal(markFirstLaunchIntroComplete(null), false);
  const throwingStorage = {
    getItem() { throw new Error("blocked"); },
    setItem() { throw new Error("blocked"); },
  };
  assert.equal(shouldShowFirstLaunchIntro(throwingStorage), false);
  assert.equal(markFirstLaunchIntroComplete(throwingStorage), false);
});
