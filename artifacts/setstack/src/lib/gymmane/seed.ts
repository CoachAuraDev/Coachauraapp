import { installProgram } from "./apply.ts";
import { kExercises } from "./catalog.ts";
import { isoWeekday, shiftIso, todayIso, uid } from "./engine.ts";
import { matchExercise } from "./match.ts";
import type { Client, ExerciseLog, SessionLog, SetLog } from "./models.ts";
import { kProgramTemplates } from "./programs.ts";

function planDates(weekdays: number[], count: number, skipRecent: number, today: string): string[] {
  const all: string[] = [];
  for (let index = 0; index < 260 && all.length < count + skipRecent; index += 1) {
    const iso = shiftIso(today, -index);
    if (weekdays.includes(isoWeekday(iso))) all.push(iso);
  }
  return all.slice(skipRecent, skipRecent + count);
}

function logged(rows: [number, number, number?][]): SetLog[] {
  return rows.map(([reps, weight, rpe]) => ({
    id: uid(),
    reps,
    weight,
    kind: "normal" as const,
    rpe: rpe ?? null,
  }));
}

function lift(name: string, rows: [number, number, number?][]): ExerciseLog {
  const exercise = matchExercise(name, kExercises);
  if (!exercise) throw new Error(`Seed exercise not found: ${name}`);
  return {
    id: exercise.id,
    name: exercise.name,
    primary: exercise.primary,
    equipment: exercise.equipment,
    sets: logged(rows),
  };
}

function base(partial: Omit<Client, "sessions" | "routines" | "weeklyPlan" | "bodyweight">): Client {
  return { ...partial, sessions: [], routines: [], weeklyPlan: {}, bodyweight: [] };
}

export function seedClients(today = todayIso()): Client[] {
  const full = kProgramTemplates.find((template) => template.id === "fullbody")!;
  const lifts = kProgramTemplates.find((template) => template.id === "stronglifts")!;

  let amina = base({
    id: "seed-amina",
    name: "Amina Okonkwo",
    sex: "female",
    age: 31,
    heightCm: 168,
    weightKg: 64,
    activity: 1.55,
    weeklyGoal: 3,
    neckCm: 32,
    waistCm: 68,
    hipCm: 94,
    notes: "Left knee likes a longer warm-up. Goal: squat 90 kg.",
    restSeconds: 120,
    since: shiftIso(today, 70),
  });
  amina = installProgram(amina, full, kExercises).client;
  const aminaRoutine = amina.routines[0]?.id ?? null;
  amina.sessions = planDates([1, 3, 5], 8, 0, today).map((date, index) => {
    const squat = 72.5 - index * 2.5;
    const bench = 40 - index * 1.25;
    const session: SessionLog = {
      id: `seed-amina-${index}`,
      date,
      durationSec: 48 * 60,
      name: "Full Body",
      routineId: aminaRoutine,
      exercises: [
        lift("Barbell Squat", [
          [5, squat, 8],
          [5, squat, 8],
          [5, Math.max(20, squat - 2.5), 7.5],
        ]),
        lift("Barbell Bench Press", [
          [5, bench, 8],
          [5, bench, 8],
        ]),
        lift("Barbell Row", [
          [8, 32.5, 7],
          [8, 32.5],
        ]),
      ],
    };
    return session;
  });
  amina.bodyweight = [
    { date: shiftIso(today, 40), kg: 65.4 },
    { date: shiftIso(today, 12), kg: 64.2 },
  ];

  const leo = base({
    id: "seed-leo",
    name: "Leo Park",
    sex: "male",
    age: 27,
    heightCm: 180,
    weightKg: 82,
    activity: 1.725,
    weeklyGoal: 4,
    neckCm: 39,
    waistCm: 82,
    hipCm: null,
    notes: "Bench block. Stop the set at RPE 8.",
    restSeconds: 150,
    since: shiftIso(today, 50),
  });
  const benchRoutine = {
    id: "seed-leo-bench",
    name: "Bench day",
    group: "Custom",
    exerciseIds: [] as string[],
    sets: {} as Record<string, number>,
    plan: {},
    rest: {} as Record<string, number>,
  };
  const bench = matchExercise("Barbell Bench Press")!;
  const press = matchExercise("Overhead Press")!;
  const row = matchExercise("Barbell Row")!;
  benchRoutine.exerciseIds = [bench.id, press.id, row.id];
  benchRoutine.sets = { [bench.id]: 5, [press.id]: 3, [row.id]: 3 };
  benchRoutine.rest = { [bench.id]: 180, [press.id]: 120, [row.id]: 90 };
  leo.routines = [benchRoutine];
  leo.weeklyPlan = { "1": benchRoutine.id, "4": benchRoutine.id };
  leo.sessions = planDates([1, 4], 6, 0, today).map((date, index) => ({
    id: `seed-leo-${index}`,
    date,
    durationSec: 55 * 60,
    name: "Bench day",
    routineId: benchRoutine.id,
    exercises: [
      lift("Barbell Bench Press", [
        [5, 100 - index * 2.5, index === 0 ? 8 : 7.5],
        [5, 100 - index * 2.5, 8],
        [3, 102.5 - index * 2.5, 9],
      ]),
      lift("Overhead Press", [
        [6, 50 - index, 8],
        [6, 50 - index],
      ]),
      lift("Barbell Row", [
        [8, 70, 7.5],
        [8, 70],
      ]),
    ],
  }));

  let jonah = base({
    id: "seed-jonah",
    name: "Jonah Hale",
    sex: "male",
    age: 36,
    heightCm: 176,
    weightKg: 91,
    activity: 1.55,
    weeklyGoal: 3,
    neckCm: 40,
    waistCm: 90,
    hipCm: null,
    notes: "Chasing a DOTS total. Missed the last two weeks.",
    restSeconds: 180,
    since: shiftIso(today, 90),
  });
  jonah = installProgram(jonah, lifts, kExercises).client;
  jonah.sessions = planDates([1, 3], 6, 4, today).map((date, index) => ({
    id: `seed-jonah-${index}`,
    date,
    durationSec: 70 * 60,
    name: index % 2 === 0 ? "Workout A" : "Workout B",
    routineId: jonah.routines[index % 2]?.id ?? null,
    exercises:
      index % 2 === 0
        ? [
            lift("Barbell Squat", [
              [5, 150 - index * 2.5, 8],
              [5, 150 - index * 2.5, 8],
            ]),
            lift("Barbell Bench Press", [
              [5, 110 - index * 2.5, 8],
              [5, 110 - index * 2.5],
            ]),
            lift("Barbell Row", [[5, 90, 8]]),
          ]
        : [
            lift("Barbell Squat", [[5, 150 - index * 2.5, 8]]),
            lift("Overhead Press", [[5, 62.5, 8]]),
            lift("Deadlift", [
              [3, 180 - index * 2.5, 8.5],
              [3, 180 - index * 2.5, 9],
            ]),
          ],
  }));

  return [amina, leo, jonah];
}
