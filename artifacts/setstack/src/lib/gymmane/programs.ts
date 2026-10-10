// Program templates from GymMane lib/catalog/program_templates.dart (GPL-3.0).
// Weekday uses GymMane's clock: 1 = Monday … 7 = Sunday.
// applyTemplate only fills an empty weekly plan and skips unmatched names.

export type ProgramDay = {
  name: string;
  exercises: [string, number][];
  weekday?: number;
};

export type ProgramTemplate = {
  id: string;
  name: string;
  days: ProgramDay[];
};

export const kProgramTemplates: ProgramTemplate[] = [
  {
    id: "fullbody",
    name: "Full Body",
    days: [1, 3, 5].map((weekday) => ({
      name: "Full Body",
      weekday,
      exercises: [
        ["Barbell Squat", 3],
        ["Barbell Bench Press", 3],
        ["Barbell Row", 3],
        ["Overhead Press", 3],
        ["Romanian Deadlift", 3],
        ["Plank", 3],
      ],
    })),
  },
  {
    id: "ppl",
    name: "Push Pull Legs",
    days: [
      {
        name: "Push",
        weekday: 1,
        exercises: [
          ["Barbell Bench Press", 4],
          ["Incline Dumbbell Press", 3],
          ["Overhead Press", 3],
          ["Lateral Raise", 3],
          ["Triceps Pushdown", 3],
        ],
      },
      {
        name: "Pull",
        weekday: 3,
        exercises: [
          ["Pull Up", 4],
          ["Barbell Row", 4],
          ["Lat Pulldown", 3],
          ["Face Pull", 3],
          ["Barbell Curl", 3],
        ],
      },
      {
        name: "Legs",
        weekday: 5,
        exercises: [
          ["Barbell Squat", 4],
          ["Romanian Deadlift", 3],
          ["Leg Press", 3],
          ["Leg Curl", 3],
          ["Standing Calf Raise", 4],
        ],
      },
    ],
  },
  {
    id: "upperlower",
    name: "Upper Lower",
    days: [
      {
        name: "Upper",
        weekday: 1,
        exercises: [
          ["Barbell Bench Press", 4],
          ["Barbell Row", 4],
          ["Overhead Press", 3],
          ["Lat Pulldown", 3],
          ["Barbell Curl", 3],
          ["Triceps Pushdown", 3],
        ],
      },
      {
        name: "Lower",
        weekday: 2,
        exercises: [
          ["Barbell Squat", 4],
          ["Romanian Deadlift", 3],
          ["Leg Press", 3],
          ["Leg Curl", 3],
          ["Standing Calf Raise", 4],
        ],
      },
      {
        name: "Upper",
        weekday: 4,
        exercises: [
          ["Incline Dumbbell Press", 4],
          ["Pull Up", 4],
          ["Dumbbell Standing Overhead Press", 3],
          ["Seated Cable Row", 3],
          ["Hammer Curl", 3],
          ["Triceps Dip", 3],
        ],
      },
      {
        name: "Lower",
        weekday: 5,
        exercises: [
          ["Deadlift", 3],
          ["Front Squat", 3],
          ["Leg Extension", 3],
          ["Leg Curl", 3],
          ["Standing Calf Raise", 4],
        ],
      },
    ],
  },
  {
    id: "abcd",
    name: "ABCD Split",
    days: [
      {
        name: "A · Chest & Triceps",
        weekday: 1,
        exercises: [
          ["Barbell Bench Press", 4],
          ["Incline Dumbbell Press", 3],
          ["Cable Fly", 3],
          ["Triceps Pushdown", 3],
          ["Skull Crushers", 3],
        ],
      },
      {
        name: "B · Back & Biceps",
        weekday: 2,
        exercises: [
          ["Pull Up", 4],
          ["Barbell Row", 4],
          ["Lat Pulldown", 3],
          ["Barbell Curl", 3],
          ["Hammer Curl", 3],
        ],
      },
      {
        name: "C · Legs",
        weekday: 4,
        exercises: [
          ["Barbell Squat", 4],
          ["Romanian Deadlift", 3],
          ["Leg Press", 3],
          ["Leg Curl", 3],
          ["Standing Calf Raise", 4],
        ],
      },
      {
        name: "D · Shoulders & Abs",
        weekday: 5,
        exercises: [
          ["Overhead Press", 4],
          ["Lateral Raise", 3],
          ["Face Pull", 3],
          ["Hanging Leg Raise", 3],
          ["Plank", 3],
        ],
      },
    ],
  },
  {
    id: "abcde",
    name: "ABCDE Split",
    days: [
      {
        name: "A · Chest",
        weekday: 1,
        exercises: [
          ["Barbell Bench Press", 4],
          ["Incline Dumbbell Press", 4],
          ["Cable Fly", 3],
          ["Triceps Dip", 3],
        ],
      },
      {
        name: "B · Back",
        weekday: 2,
        exercises: [
          ["Deadlift", 3],
          ["Pull Up", 4],
          ["Barbell Row", 4],
          ["Seated Cable Row", 3],
        ],
      },
      {
        name: "C · Legs",
        weekday: 3,
        exercises: [
          ["Barbell Squat", 4],
          ["Leg Press", 4],
          ["Leg Extension", 3],
          ["Leg Curl", 3],
          ["Standing Calf Raise", 4],
        ],
      },
      {
        name: "D · Shoulders",
        weekday: 4,
        exercises: [
          ["Overhead Press", 4],
          ["Dumbbell Standing Overhead Press", 3],
          ["Lateral Raise", 4],
          ["Face Pull", 3],
        ],
      },
      {
        name: "E · Arms",
        weekday: 5,
        exercises: [
          ["Barbell Curl", 4],
          ["Skull Crushers", 4],
          ["Hammer Curl", 3],
          ["Triceps Pushdown", 3],
        ],
      },
    ],
  },
  {
    id: "stronglifts",
    name: "StrongLifts 5×5",
    days: [
      {
        name: "Workout A",
        weekday: 1,
        exercises: [
          ["Barbell Squat", 5],
          ["Barbell Bench Press", 5],
          ["Barbell Row", 5],
        ],
      },
      {
        name: "Workout B",
        weekday: 3,
        exercises: [
          ["Barbell Squat", 5],
          ["Overhead Press", 5],
          ["Deadlift", 1],
        ],
      },
    ],
  },
  {
    id: "startingstrength",
    name: "Starting Strength",
    days: [
      {
        name: "Workout A",
        weekday: 1,
        exercises: [
          ["Barbell Squat", 3],
          ["Barbell Bench Press", 3],
          ["Deadlift", 1],
        ],
      },
      {
        name: "Workout B",
        weekday: 3,
        exercises: [
          ["Barbell Squat", 3],
          ["Overhead Press", 3],
          ["Barbell Row", 3],
        ],
      },
    ],
  },
  {
    id: "rr",
    name: "Recommended Routine",
    days: [1, 3, 5].map((weekday) => ({
      name: "Recommended Routine",
      weekday,
      exercises: [
        ["Negative Pull-up", 3],
        ["Bodyweight Squat", 3],
        ["Negative Dip", 3],
        ["Bodyweight Romanian Deadlift", 3],
        ["Incline Row", 3],
        ["Incline Push-up", 3],
        ["Plank", 3],
        ["Banded Pallof Press", 3],
        ["Reverse Hyperextension", 3],
      ] as [string, number][],
    })),
  },
  {
    id: "home",
    name: "No Kit",
    days: [
      {
        name: "Home A",
        weekday: 2,
        exercises: [
          ["Push Up", 3],
          ["Pull Up", 3],
          ["Bodyweight Squat", 3],
          ["Plank", 3],
        ],
      },
      {
        name: "Home B",
        weekday: 5,
        exercises: [
          ["Triceps Dip", 3],
          ["Chin Up", 3],
          ["Lunge", 3],
          ["Hanging Leg Raise", 3],
        ],
      },
    ],
  },
];
