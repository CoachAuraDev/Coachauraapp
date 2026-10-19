import assert from "node:assert/strict";
import test from "node:test";
import { isValidCalendarDate } from "./calendar-date.ts";

test("calendar date validation accepts real ISO calendar dates", () => {
  assert.equal(isValidCalendarDate("2024-02-29"), true);
  assert.equal(isValidCalendarDate("2025-01-01"), true);
});

test("calendar date validation rejects impossible, malformed, and non-string values", () => {
  assert.equal(isValidCalendarDate("2025-02-29"), false);
  assert.equal(isValidCalendarDate("2025-02-30"), false);
  assert.equal(isValidCalendarDate("2025-2-03"), false);
  assert.equal(isValidCalendarDate(20250101), false);
});
