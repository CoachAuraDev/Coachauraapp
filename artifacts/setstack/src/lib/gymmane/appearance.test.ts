import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_APPEARANCE, APPEARANCE_THEMES, isAppearanceTheme, normalizeSavedAppearance } from "./appearance.ts";
import { useFloor } from "./store.ts";
import { encodeBackup, inspectBackup, validateSavedFloor } from "./backup.ts";

test("only the two dark CoachAura themes are offered and new installations default to Original Lime Green", () => {
  assert.equal(DEFAULT_APPEARANCE, "default");
  assert.deepEqual(APPEARANCE_THEMES.map((item) => item.value), [
    "default", "orange-charcoal",
  ]);
  assert.ok(APPEARANCE_THEMES.every((item) => item.swatches.length === 3));
  assert.deepEqual(APPEARANCE_THEMES.map((item) => item.label), [
    "Original Lime Green", "Peach Theme",
  ]);
  assert.deepEqual(APPEARANCE_THEMES[0]?.swatches, ["#0B0B0D", "#17171B", "#B7F34A"]);
  assert.deepEqual(APPEARANCE_THEMES[1]?.swatches, ["#111214", "#1B1C1F", "#E8A87C"]);
  assert.equal(isAppearanceTheme("orange-charcoal"), true);
  assert.equal(isAppearanceTheme("default"), true);
  assert.equal(isAppearanceTheme("orange-light-grey"), false);
  assert.equal(isAppearanceTheme("light-lime-charcoal"), false);
  assert.equal(isAppearanceTheme("light-lime-grey"), false);
  assert.equal(isAppearanceTheme("unsupported"), false);
  const state = useFloor.getState();
  const oldShape = {
    clients: [], custom: [], templates: [], draft: null, unit: "kg",
  };
  assert.equal(validateSavedFloor(oldShape).appearance, DEFAULT_APPEARANCE);
  assert.equal(validateSavedFloor({ ...oldShape, appearance: "default" }).appearance, "default");
  assert.equal(validateSavedFloor({ ...oldShape, appearance: "orange-charcoal" }).appearance, "orange-charcoal");
  assert.equal(validateSavedFloor({ ...oldShape, appearance: "orange-light-grey" }).appearance, "orange-charcoal");
  assert.equal(validateSavedFloor({ ...oldShape, appearance: "light-lime-charcoal" }).appearance, "default");
  assert.equal(validateSavedFloor({ ...oldShape, appearance: "light-lime-grey" }).appearance, "default");
  assert.throws(() => normalizeSavedAppearance("unsupported"), /unsupported theme/);
  assert.equal(state.appearance, DEFAULT_APPEARANCE);
});

test("selected appearance survives a local-store rehydration", async () => {
  const { setAppearance } = useFloor.getState();
  for (const { value: appearance } of APPEARANCE_THEMES) {
    setAppearance(appearance);
    assert.equal(useFloor.getState().appearance, appearance);
    await useFloor.persist.rehydrate();
    assert.equal(useFloor.getState().appearance, appearance);
  }
  useFloor.getState().setAppearance(DEFAULT_APPEARANCE);
});

test("the two themes roundtrip in backups and retired theme values migrate safely", () => {
  const orange = {
    clients: [], custom: [], templates: [], draft: null, unit: "kg" as const,
    appearance: "orange-charcoal" as const,
  };
  const current = { ...orange, appearance: "default" as const };
  const roundtrip = inspectBackup(encodeBackup(orange), current);
  assert.equal(roundtrip.ok, true);
  if (roundtrip.ok) assert.equal(roundtrip.preview.data.appearance, "orange-charcoal");
  const older = JSON.parse(encodeBackup(orange)) as Record<string, unknown>;
  delete older.appearance;
  const compatible = inspectBackup(JSON.stringify(older), current);
  assert.equal(compatible.ok, true);
  if (compatible.ok) assert.equal(compatible.preview.data.appearance, "default");

  const retired = { app: "CoachAura", version: 2, ...orange, appearance: "light-lime-charcoal" };
  const migrated = inspectBackup(JSON.stringify(retired), current);
  assert.equal(migrated.ok, true);
  if (migrated.ok) assert.equal(migrated.preview.data.appearance, "default");
});
