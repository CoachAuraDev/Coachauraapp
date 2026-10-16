import assert from "node:assert/strict";
import { test } from "node:test";
import { isRapidDuplicateSubmission } from "./submission-guard.ts";

test("only suppresses the same action inside the double-tap window", () => {
  const previous = { key: "bench|work|52.5|7|2", at: 1_000 };

  assert.equal(isRapidDuplicateSubmission(previous, previous.key, 1_250), true);
  assert.equal(isRapidDuplicateSubmission(previous, previous.key, 1_499), true);
  assert.equal(isRapidDuplicateSubmission(previous, previous.key, 1_500), false);
  assert.equal(isRapidDuplicateSubmission(previous, "bench|work|55|7|2", 1_100), false);
});

test("does not suppress the first submit or treat a backwards clock as a duplicate", () => {
  const previous = { key: "row|work|30|10|3", at: 1_000 };

  assert.equal(isRapidDuplicateSubmission(null, previous.key, 1_050), false);
  assert.equal(isRapidDuplicateSubmission(previous, previous.key, 900), false);
});
