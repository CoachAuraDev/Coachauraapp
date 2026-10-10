import assert from "node:assert/strict";
import test from "node:test";
import { consumeNativeBack, registerNativeBackHandler } from "./back-handlers.ts";

test("Android Back closes the most recently opened overlay before navigating", () => {
  const calls: string[] = [];
  const closeDrawer = registerNativeBackHandler(() => calls.push("drawer"));
  const closeModal = registerNativeBackHandler(() => calls.push("modal"));
  assert.equal(consumeNativeBack(), true);
  assert.deepEqual(calls, ["modal"]);
  closeModal();
  closeModal(); // Cleanup is idempotent.
  assert.equal(consumeNativeBack(), true);
  assert.deepEqual(calls, ["modal", "drawer"]);
  closeDrawer();
  assert.equal(consumeNativeBack(), false);
});
