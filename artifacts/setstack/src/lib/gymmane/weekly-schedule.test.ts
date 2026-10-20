import test from "node:test";
import assert from "node:assert/strict";
import { weekdayForLocalDate, INDIVIDUAL_WEEKDAYS } from "./weekly-schedule.ts";

test("Monday-first local weekday mapping handles every day and rejects invalid dates", () => {
  assert.deepEqual(INDIVIDUAL_WEEKDAYS.map(({ day }) => day), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(weekdayForLocalDate("2026-10-19"), 1);
  assert.equal(weekdayForLocalDate("2026-10-20"), 2);
  assert.equal(weekdayForLocalDate("2026-10-21"), 3);
  assert.equal(weekdayForLocalDate("2026-10-22"), 4);
  assert.equal(weekdayForLocalDate("2026-10-23"), 5);
  assert.equal(weekdayForLocalDate("2026-10-24"), 6);
  assert.equal(weekdayForLocalDate("2026-10-25"), 7);
  assert.throws(() => weekdayForLocalDate("2026-02-30"), RangeError);
  assert.throws(() => weekdayForLocalDate("Monday"), RangeError);
});
