import assert from "node:assert/strict";
import test from "node:test";
import {
  bmi,
  bmiCategory,
  dotsScore,
  ffmi,
  ffmiLevel,
  formatLoad,
  navyBodyFat,
  oneRm,
  platesPerSide,
  rpeLoad,
  rpePercent,
  strengthLevel,
  tdee,
  warmupSets,
  wilksScore,
} from "./engine.ts";
import { matchExercise } from "./match.ts";

test("RTS table matches GymMane", () => {
  assert.equal(rpePercent(1, 10), 1);
  assert.ok(Math.abs((rpePercent(5, 8) ?? 0) - 0.811) < 1e-9);
  assert.ok(Math.abs((rpePercent(3, 9.5) ?? 0) - 0.907) < 1e-9);
  assert.ok(Math.abs((rpePercent(12, 6) ?? 0) - 0.574) < 1e-9);
  assert.equal(rpePercent(5, null), null);
  assert.equal(rpePercent(5, 5), null);
  assert.equal(rpePercent(13, 8), null);
  assert.equal(rpePercent(0, 8), null);
});

test("one-rep uses the chart when RPE is present, else Epley", () => {
  assert.ok(Math.abs(oneRm(5, 100, 8) - 100 / 0.811) < 1e-6);
  assert.ok(Math.abs(oneRm(5, 100) - 100 * (1 + 5 / 30)) < 1e-6);
  assert.ok(Math.abs(oneRm(15, 50, 8) - 50 * (1 + 15 / 30)) < 1e-6);
  assert.ok(Math.abs(oneRm(5, 100) - 116.666) < 0.01);
  assert.equal(Math.round(oneRm(5, 100) * 10) / 10, 116.7);
  assert.equal(Math.round(oneRm(1, 140) * 10) / 10, 144.7);
});

test("RPE load matches GymMane's new tools", () => {
  const result = rpeLoad(100, 5, 8, 3, 9, 2.5);
  assert.ok(Math.abs(result.oneRm - 123.3) < 0.05);
  assert.equal(result.load, 110);
  assert.equal(rpeLoad(80, 8, 7.5, 8, 7.5, 2.5).load, 80);
});

test("BMI, calories, body fat, FFMI", () => {
  assert.ok(Math.abs(bmi(75, 175) - 24.5) < 0.05);
  assert.equal(bmiCategory(18.4), "Underweight");
  assert.equal(bmiCategory(18.5), "Normal");
  assert.equal(bmiCategory(25), "Overweight");
  assert.equal(bmiCategory(30), "Obese");
  assert.equal(tdee("male", 75, 175, 28, 1.55), 2649);
  assert.equal(tdee("female", 75, 175, 28, 1), 1543);
  assert.ok(Math.abs(navyBodyFat("male", 175, 38, 84) - 16.2) < 0.15);
  assert.ok(Math.abs(ffmi(175, 75, 15) - 21.1) < 0.05);
  assert.equal(ffmiLevel(21.1, "male"), 2);
  assert.ok(ffmiLevel(ffmi(165, 60, 22), "female") > ffmiLevel(ffmi(165, 60, 22), "male"));
});

test("plates, warm-up, DOTS, Wilks", () => {
  const plates = platesPerSide(100, 20);
  assert.deepEqual(
    plates.map((plate) => `${plate.weight}x${plate.count}`),
    ["25x1", "15x1"],
  );
  for (const target of [60, 82.5, 100, 142.5, 227.5]) {
    const perSide = platesPerSide(target, 20).reduce((sum, plate) => sum + plate.weight * plate.count, 0);
    assert.ok(Math.abs(perSide * 2 + 20 - target) < 0.02, String(target));
  }
  assert.deepEqual(platesPerSide(20, 20), []);
  const warm = warmupSets(100, 2.5);
  assert.deepEqual(
    warm.map((set) => set.pct),
    ["40%", "60%", "80%", "90%"],
  );
  assert.deepEqual(
    warm.map((set) => set.weight),
    [40, 60, 80, 90],
  );
  assert.deepEqual(
    warm.map((set) => set.reps),
    [10, 5, 3, 1],
  );
  assert.ok(Math.abs(dotsScore("male", 80, 500) - 344.8) < 0.5);
  assert.equal(strengthLevel(dotsScore("male", 80, 500)), 2);
  assert.ok(dotsScore("female", 60, 280) > dotsScore("male", 60, 280));
  assert.ok(Math.abs(wilksScore("male", 80, 420) - 286.7) < 0.05);
  assert.ok(Math.abs(wilksScore("female", 60, 300) - 334.5) < 0.05);
});

test("program names resolve through GymMane's matcher", () => {
  assert.equal(matchExercise("Barbell Squat")?.name, "Barbell Full Squat");
  assert.equal(matchExercise("Barbell Row")?.name, "Barbell Bent Over Row");
  assert.equal(matchExercise("Deadlift")?.name, "Barbell Deadlift");
  assert.equal(matchExercise("Romanian Deadlift")?.name, "Barbell Romanian Deadlift");
  assert.equal(matchExercise("Pull Up")?.name, "Pull-up");
  assert.ok(matchExercise("Overhead Press"));
  assert.equal(matchExercise("Plank")?.id, "plank-hold");
});

test("display formatting stays in the chosen unit", () => {
  assert.equal(formatLoad(100, "kg"), "100 kg");
  assert.match(formatLoad(100, "lb"), /220\.5 lb/);
});
