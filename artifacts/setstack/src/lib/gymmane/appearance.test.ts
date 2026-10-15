import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_APPEARANCE, APPEARANCE_THEMES, isAppearanceTheme } from "./appearance.ts";
import { useFloor } from "./store.ts";
import { encodeBackup, inspectBackup, validateSavedFloor } from "./backup.ts";

test("appearance options are validated and old saved records default to the unchanged CoachAura palette", () => {
  assert.equal(DEFAULT_APPEARANCE, "default");
  assert.deepEqual(APPEARANCE_THEMES.map((item) => item.value), [
    "default", "orange-charcoal", "orange-light-grey",
  ]);
  assert.equal(isAppearanceTheme("orange-charcoal"), true);
  assert.equal(isAppearanceTheme("orange-light-grey"), true);
  assert.equal(isAppearanceTheme("unsupported"), false);
  const state = useFloor.getState();
  const oldShape = {
    clients: [], custom: [], templates: [], draft: null, unit: "kg",
  };
  assert.equal(validateSavedFloor(oldShape).appearance, DEFAULT_APPEARANCE);
  assert.equal(state.appearance, DEFAULT_APPEARANCE);
});

test("selected appearance survives a local-store rehydration", async () => {
  const { setAppearance } = useFloor.getState();
  setAppearance("orange-light-grey");
  assert.equal(useFloor.getState().appearance, "orange-light-grey");
  await useFloor.persist.rehydrate();
  assert.equal(useFloor.getState().appearance, "orange-light-grey");
  useFloor.getState().setAppearance(DEFAULT_APPEARANCE);
});

test("theme preferences roundtrip in new backups while older backups preserve the current choice", () => {
  const orange = {
    clients: [], custom: [], templates: [], draft: null, unit: "kg" as const,
    appearance: "orange-charcoal" as const,
  };
  const current = { ...orange, appearance: "orange-light-grey" as const };
  const roundtrip = inspectBackup(encodeBackup(orange), current);
  assert.equal(roundtrip.ok, true);
  if (roundtrip.ok) assert.equal(roundtrip.preview.data.appearance, "orange-charcoal");

  const older = JSON.parse(encodeBackup(orange)) as Record<string, unknown>;
  delete older.appearance;
  const compatible = inspectBackup(JSON.stringify(older), current);
  assert.equal(compatible.ok, true);
  if (compatible.ok) assert.equal(compatible.preview.data.appearance, "orange-light-grey");
});
