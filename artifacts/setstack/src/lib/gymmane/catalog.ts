// Extracted from GymMane lib/catalog/exercise_catalog.dart (InlitX, GPL-3.0).
// Source snapshot: third_party/gymmane. Steps and art are omitted; identity fields are unchanged.
export type CatalogExercise = {
  id: string;
  name: string;
  primary: string;
  secondary: string[];
  equipment: string;
  difficulty: string;
  mode: string;
  muscleMappingExplicit?: boolean;
};
export const kExercises: CatalogExercise[] = [
  {
    "id": "EIeI8Vf",
    "name": "Barbell Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "SpYC0Kp",
    "name": "Dumbbell Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "3TZduzM",
    "name": "Barbell Incline Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "ns0SIbU",
    "name": "Dumbbell Incline Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "GrO65fd",
    "name": "Barbell Decline Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "yz9nUhF",
    "name": "Dumbbell Fly",
    "primary": "chest",
    "secondary": [],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "I4hDWkc",
    "name": "Push-up",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "9WTm7dq",
    "name": "Chest Dip",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "9XjtHvS",
    "name": "Dumbbell Pullover",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "Kyd9Rz5",
    "name": "Barbell Standing Wide Military Press",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "back"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "A6wtbuL",
    "name": "Dumbbell Standing Overhead Press",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "back"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "Xy4jlWA",
    "name": "Dumbbell Arnold Press",
    "primary": "shoulders",
    "secondary": [
      "triceps"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "DsgkuIt",
    "name": "Dumbbell Lateral Raise",
    "primary": "shoulders",
    "secondary": [
      "trapezius"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "goJ6ezq",
    "name": "Cable Lateral Raise",
    "primary": "shoulders",
    "secondary": [
      "trapezius",
      "triceps"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "3eGE2JC",
    "name": "Dumbbell Front Raise",
    "primary": "shoulders",
    "secondary": [
      "biceps"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "v1qBec9",
    "name": "Dumbbell Rear Lateral Raise",
    "primary": "shoulders",
    "secondary": [
      "trapezius"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "NJzBsGJ",
    "name": "Dumbbell Shrug",
    "primary": "trapezius",
    "secondary": [],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "dG7tG5y",
    "name": "Barbell Shrug",
    "primary": "trapezius",
    "secondary": [],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "ila4NZS",
    "name": "Barbell Deadlift",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "lowerback"
    ],
    "equipment": "Barbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "wQ2c4XD",
    "name": "Barbell Romanian Deadlift",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "lowerback"
    ],
    "equipment": "Barbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "KgI0tqW",
    "name": "Barbell Sumo Deadlift",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "lowerback"
    ],
    "equipment": "Barbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "eZyBC3j",
    "name": "Barbell Bent Over Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm",
      "lowerback"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "BJ0Hz5L",
    "name": "Dumbbell Bent Over Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm",
      "lowerback"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "r0z6xzQ",
    "name": "Barbell Pendlay Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm",
      "lowerback"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "fUBheHs",
    "name": "Cable Seated Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "RVwzP10",
    "name": "Cable Pulldown",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "lBDjFxJ",
    "name": "Pull-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "T2mxWqc",
    "name": "Chin-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "qXTaZnJ",
    "name": "Barbell Full Squat",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "zG0zs85",
    "name": "Barbell Front Squat",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "yn8yg1r",
    "name": "Dumbbell Goblet Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "7zdxRTl",
    "name": "Leg Press",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "RRWFUcw",
    "name": "Dumbbell Lunge",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "qx4fgX7",
    "name": "Dumbbell Single Leg Split Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "XlZ4lAC",
    "name": "Barbell Good Morning",
    "primary": "hamstrings",
    "secondary": [
      "lowerback"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "qKBpF7I",
    "name": "Barbell Glute Bridge",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "OM46QHm",
    "name": "Cable Pull Through (With Rope)",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "8ozhUIZ",
    "name": "Barbell Standing Calf Raise",
    "primary": "calves",
    "secondary": [
      "hamstrings",
      "glutes"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "ktsFQAZ",
    "name": "Barbell Seated Calf Raise",
    "primary": "calves",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "25GPyDY",
    "name": "Barbell Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "NbVPDMW",
    "name": "Dumbbell Biceps Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "slDvUAU",
    "name": "Dumbbell Hammer Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "qOgPVf6",
    "name": "Barbell Preacher Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "gvsWLQw",
    "name": "Dumbbell Concentration Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "3ZflifB",
    "name": "Cable Pushdown",
    "primary": "triceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "iZop9xO",
    "name": "Barbell Lying Triceps Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "PdmaD0N",
    "name": "Dumbbell Standing Triceps Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "2IxROQ1",
    "name": "Cable Overhead Triceps Extension (Rope Attachment)",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "X6C6i5Y",
    "name": "Triceps Dip",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "VBAWRPG",
    "name": "Weighted Front Plank",
    "primary": "abdomen",
    "secondary": [],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "TFqbd8t",
    "name": "Crunch Floor",
    "primary": "abdomen",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "QOA0FD0",
    "name": "Hanging Leg Raise",
    "primary": "abdomen",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "XVDdcoj",
    "name": "Russian Twist",
    "primary": "abdomen",
    "secondary": [
      "obliques"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "cA9FuWG",
    "name": "Barbell Bent Arm Pullover",
    "primary": "back",
    "secondary": [
      "triceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "7vG5o25",
    "name": "Dumbbell Incline Row",
    "primary": "back",
    "secondary": [
      "biceps"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "72BC5Za",
    "name": "Archer Pull Up",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "Gk1r408",
    "name": "Weighted Chin-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "PbzNu7c",
    "name": "Dumbbell Incline Y-raise",
    "primary": "back",
    "secondary": [],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kiJ4Z2K",
    "name": "Assisted Pull-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "8urJS9b",
    "name": "Back Extension",
    "primary": "lowerback",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "Hj4FOCd",
    "name": "Barbell Decline Wide-grip Pullover",
    "primary": "back",
    "secondary": [
      "triceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "7OeHptV",
    "name": "Assisted Standing Chin-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "mExgrF9",
    "name": "Bench Pull-ups",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "7I6LNUG",
    "name": "Machine Seated Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "HMzLjXx",
    "name": "Weighted Pull-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "aaXr7ld",
    "name": "T-Bar Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm",
      "lowerback"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "face-pull",
    "name": "Face Pull",
    "primary": "back",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "one-arm-dumbbell-row",
    "name": "One-Arm Dumbbell Row",
    "primary": "back",
    "secondary": [
      "biceps"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "close-grip-lat-pulldown",
    "name": "Close-Grip Lat Pulldown",
    "primary": "back",
    "secondary": [
      "biceps"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "wide-grip-lat-pulldown",
    "name": "Wide-Grip Lat Pulldown",
    "primary": "back",
    "secondary": [
      "biceps"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "single-arm-cable-row",
    "name": "Single-Arm Cable Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "shoulders"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "meadows-row",
    "name": "Meadows Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "shoulders"
    ],
    "equipment": "Barbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "neutral-grip-pull-up",
    "name": "Neutral-Grip Pull-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "active-hang",
    "name": "Active Hang",
    "primary": "back",
    "secondary": [
      "forearm",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "negative-pull-up",
    "name": "Negative Pull-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "commando-pull-up",
    "name": "Commando Pull-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "l-sit-pull-up",
    "name": "L-Sit Pull-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "towel-pull-up",
    "name": "Towel Pull-up",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "towel-row",
    "name": "Towel Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "scapular-push-up",
    "name": "Scapular Push-up",
    "primary": "back",
    "secondary": [
      "chest",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "prone-t-raise",
    "name": "Prone T Raise",
    "primary": "back",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "superman",
    "name": "Superman",
    "primary": "lowerback",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "superman-hold",
    "name": "Superman Hold",
    "primary": "lowerback",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "reverse-snow-angel",
    "name": "Reverse Snow Angel",
    "primary": "back",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "band-pull-apart",
    "name": "Band Pull-Apart",
    "primary": "back",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-face-pull",
    "name": "Banded Face Pull",
    "primary": "back",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-row",
    "name": "Banded Row",
    "primary": "back",
    "secondary": [
      "biceps"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-lat-pulldown",
    "name": "Banded Lat Pulldown",
    "primary": "back",
    "secondary": [
      "biceps",
      "abdomen"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "cat-cow-stretch",
    "name": "Cat-Cow Stretch",
    "primary": "back",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "worlds-greatest-stretch",
    "name": "World's Greatest Stretch",
    "primary": "back",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "leg-swings-stretch",
    "name": "Leg Swings",
    "primary": "back",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "childs-pose",
    "name": "Child's Pose",
    "primary": "back",
    "secondary": [
      "shoulders",
      "glutes"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "rowing",
    "name": "Rowing Machine",
    "primary": "back",
    "secondary": [
      "quads",
      "biceps"
    ],
    "equipment": "Machine",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "skierg",
    "name": "Ski Erg",
    "primary": "back",
    "secondary": [
      "triceps",
      "abdomen"
    ],
    "equipment": "Machine",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "swimming",
    "name": "Swim Bench",
    "primary": "back",
    "secondary": [
      "shoulders",
      "triceps"
    ],
    "equipment": "Machine",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "PAgTVaK",
    "name": "Assisted Chest Dip (Kneeling)",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "A9qxk2F",
    "name": "Archer Push Up",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "PSlvNMs",
    "name": "Weighted Push-up",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "hl8DUh8",
    "name": "Barbell Decline Wide-grip Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "0CXGHya",
    "name": "Cable Crossover",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "33AzZeV",
    "name": "Barbell Front Raise and Pullover",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "DwhEmmE",
    "name": "Dumbbell Decline Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "WbNq5Xu",
    "name": "Machine Chest Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "xXm4nYq",
    "name": "Dumbbell Decline Fly",
    "primary": "chest",
    "secondary": [],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "7E06s6d",
    "name": "Chest Tap Push-up",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "trqKQv2",
    "name": "Smith Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "wigSg76",
    "name": "Clap Push Up",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "JsKq9so",
    "name": "Barbell Wide Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "tBWXbIT",
    "name": "Cable Incline Fly",
    "primary": "chest",
    "secondary": [
      "triceps"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "pec-deck",
    "name": "Pec Deck",
    "primary": "chest",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "incline-push-up",
    "name": "Incline Push-up",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "knee-push-up",
    "name": "Knee Push-up",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "wide-push-up",
    "name": "Wide Push-up",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "triceps"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "decline-push-up",
    "name": "Decline Push-up",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "triceps"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "typewriter-push-up",
    "name": "Typewriter Push-up",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "hindu-push-up",
    "name": "Hindu Push-up",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "triceps"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "wall-push-up",
    "name": "Wall Push-up",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "seal-jack",
    "name": "Seal Jack",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "doorway-chest-stretch",
    "name": "Doorway Chest Stretch",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "back"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "myfUsKf",
    "name": "Machine Reverse Fly",
    "primary": "shoulders",
    "secondary": [],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "e4aFmFY",
    "name": "Plate Front Raise",
    "primary": "shoulders",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Weighted",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "xHKN2s8",
    "name": "Barbell One Arm Snatch",
    "primary": "shoulders",
    "secondary": [
      "trapezius",
      "forearm"
    ],
    "equipment": "Barbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "aqvSOQE",
    "name": "Cable Reverse Fly",
    "primary": "shoulders",
    "secondary": [],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "67n3r98",
    "name": "Lever Shoulder Press",
    "primary": "shoulders",
    "secondary": [
      "triceps"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "3d7wHyd",
    "name": "Seated Dumbbell Shoulder Press",
    "primary": "shoulders",
    "secondary": [
      "triceps"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "VLYXo8S",
    "name": "Weighted Arm Circles",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "back"
    ],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "S9zHIvU",
    "name": "Barbell Rear Delt Row",
    "primary": "shoulders",
    "secondary": [
      "biceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "u2X71Np",
    "name": "Cable Front Raise",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "nFUwqG6",
    "name": "Smith Rear Delt Row",
    "primary": "shoulders",
    "secondary": [
      "biceps"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "903mzG8",
    "name": "Smith Shoulder Press",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "back"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kTbSH9h",
    "name": "Barbell Seated Overhead Press",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "back"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "upright-row",
    "name": "Upright Row",
    "primary": "shoulders",
    "secondary": [
      "back",
      "biceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "machine-lateral-raise",
    "name": "Machine Lateral Raise",
    "primary": "shoulders",
    "secondary": [
      "back"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "landmine-press",
    "name": "Landmine Press",
    "primary": "shoulders",
    "secondary": [
      "chest",
      "triceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "pike-push-up",
    "name": "Pike Push-up",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "chest"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "feet-elevated-pike-push-up",
    "name": "Feet-Elevated Pike Push-up",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "chest"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "handstand-push-up",
    "name": "Handstand Push-up",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "wall-handstand-push-up",
    "name": "Wall Handstand Push-up",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "wall-walk",
    "name": "Wall Walk",
    "primary": "shoulders",
    "secondary": [
      "abdomen",
      "chest"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "cross-body-shoulder-stretch",
    "name": "Cross-Body Shoulder Stretch",
    "primary": "shoulders",
    "secondary": [
      "back"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "battle-ropes",
    "name": "Battle Ropes",
    "primary": "shoulders",
    "secondary": [
      "back",
      "abdomen"
    ],
    "equipment": "Other",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "MvQPqVW",
    "name": "Cable Woodchop",
    "primary": "abdomen",
    "secondary": [
      "obliques"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "CqhoytW",
    "name": "Smith Hip Thrust",
    "primary": "abdomen",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "IpONWYv",
    "name": "Dumbbell Side Bend",
    "primary": "abdomen",
    "secondary": [
      "obliques"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "WW95auq",
    "name": "Cable Kneeling Crunch",
    "primary": "abdomen",
    "secondary": [
      "obliques"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "s8nrDXF",
    "name": "Weighted Crunch",
    "primary": "abdomen",
    "secondary": [
      "obliques"
    ],
    "equipment": "Weighted",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "7M66AVi",
    "name": "Barbell Rollerout",
    "primary": "abdomen",
    "secondary": [],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "RqOtqD7",
    "name": "Reverse Crunch",
    "primary": "abdomen",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "qaZVsGk",
    "name": "Alternate Heel Touches",
    "primary": "abdomen",
    "secondary": [
      "obliques"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "EZeDVzO",
    "name": "Weighted Decline Sit-up",
    "primary": "abdomen",
    "secondary": [],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "uWpxD4v",
    "name": "Hanging Knee Raise",
    "primary": "abdomen",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "fZFZ704",
    "name": "Weighted Russian Twist",
    "primary": "abdomen",
    "secondary": [
      "obliques"
    ],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "G7xoEzr",
    "name": "Seated Knee Tuck",
    "primary": "abdomen",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "6bOA1Oi",
    "name": "Weighted Side Bend (On Stability Ball)",
    "primary": "abdomen",
    "secondary": [
      "obliques"
    ],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "captains-chair-knee-raise",
    "name": "Captain's Chair Knee Raise",
    "primary": "abdomen",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "bicycle-crunch",
    "name": "Bicycle Crunch",
    "primary": "abdomen",
    "secondary": [
      "obliques",
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "mountain-climber",
    "name": "Mountain Climber",
    "primary": "abdomen",
    "secondary": [
      "shoulders",
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "dead-bug",
    "name": "Dead Bug",
    "primary": "abdomen",
    "secondary": [
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "bird-dog",
    "name": "Bird Dog",
    "primary": "abdomen",
    "secondary": [
      "glutes",
      "shoulders",
      "lowerback"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "pallof-press",
    "name": "Pallof Press",
    "primary": "abdomen",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "half-kneeling-pallof-press",
    "name": "Half-Kneeling Pallof Press",
    "primary": "abdomen",
    "secondary": [
      "glutes",
      "shoulders"
    ],
    "equipment": "Cable",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "cable-pallof-hold",
    "name": "Cable Pallof Hold",
    "primary": "abdomen",
    "secondary": [
      "glutes",
      "shoulders"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "hollow-body-hold",
    "name": "Hollow Body Hold",
    "primary": "abdomen",
    "secondary": [
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "hollow-rock",
    "name": "Hollow Rock",
    "primary": "abdomen",
    "secondary": [
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "v-up",
    "name": "V-Up",
    "primary": "abdomen",
    "secondary": [
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "flutter-kick",
    "name": "Flutter Kick",
    "primary": "abdomen",
    "secondary": [
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "lying-leg-raise",
    "name": "Lying Leg Raise",
    "primary": "abdomen",
    "secondary": [
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "plank-shoulder-tap",
    "name": "Plank Shoulder Tap",
    "primary": "abdomen",
    "secondary": [
      "shoulders",
      "chest"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "plank-jack",
    "name": "Plank Jack",
    "primary": "abdomen",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "bear-plank",
    "name": "Bear Plank",
    "primary": "abdomen",
    "secondary": [
      "quads",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "bear-crawl",
    "name": "Bear Crawl",
    "primary": "abdomen",
    "secondary": [
      "shoulders",
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "inchworm",
    "name": "Inchworm",
    "primary": "abdomen",
    "secondary": [
      "shoulders",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "l-sit-hold",
    "name": "L-Sit Hold",
    "primary": "abdomen",
    "secondary": [
      "triceps",
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "side-plank-hip-dip",
    "name": "Side Plank Hip Dip",
    "primary": "obliques",
    "secondary": [
      "shoulders",
      "glutes"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "dragon-flag",
    "name": "Dragon Flag",
    "primary": "abdomen",
    "secondary": [
      "back",
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "half-burpee",
    "name": "Half Burpee",
    "primary": "abdomen",
    "secondary": [
      "quads",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "squat-thrust",
    "name": "Squat Thrust",
    "primary": "abdomen",
    "secondary": [
      "quads",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-pallof-press",
    "name": "Banded Pallof Press",
    "primary": "abdomen",
    "secondary": [
      "glutes",
      "shoulders"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-woodchop",
    "name": "Banded Woodchop",
    "primary": "obliques",
    "secondary": [
      "shoulders",
      "glutes"
    ],
    "equipment": "Band",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "banded-dead-bug",
    "name": "Banded Dead Bug",
    "primary": "abdomen",
    "secondary": [
      "glutes",
      "shoulders"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "Y7YcmIJ",
    "name": "Barbell Bench Front Squat",
    "primary": "quads",
    "secondary": [
      "hamstrings",
      "glutes",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "gFyFj9z",
    "name": "Dumbbell Step-up",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "hBGWILP",
    "name": "Cable Hip Adduction",
    "primary": "quads",
    "secondary": [
      "glutes"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "0lQnxMZ",
    "name": "Weighted Sissy Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "W9pFVv1",
    "name": "Barbell Bench Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "wWFspEi",
    "name": "Smith Single Leg Split Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "SGY8Zui",
    "name": "Barbell Push Press",
    "primary": "quads",
    "secondary": [
      "hamstrings",
      "glutes",
      "triceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "6YUfHPL",
    "name": "Bodyweight Squat",
    "primary": "quads",
    "secondary": [
      "hamstrings",
      "glutes"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "uKyN64F",
    "name": "Barbell One Leg Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "mweqJin",
    "name": "Quick Feet",
    "primary": "quads",
    "secondary": [
      "calves",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "gfk9kD4",
    "name": "Barbell Overhead Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "c8f5cSY",
    "name": "Side Lying Hip Abduction",
    "primary": "glutes",
    "secondary": [
      "obliques"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "W31mMjd",
    "name": "Lateral Lunge",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "VO2qeJg",
    "name": "Side Plank Hip Adduction",
    "primary": "obliques",
    "secondary": [
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "gGNQmVt",
    "name": "Barbell Single Leg Split Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "xdYPUtE",
    "name": "Sissy Squat",
    "primary": "quads",
    "secondary": [
      "calves",
      "glutes"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "9E25EOx",
    "name": "Split Squats",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "QChZi3x",
    "name": "Squat to Overhead Reach",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "s7HX1BY",
    "name": "Barbell Wide Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "dG5Smob",
    "name": "Rack Pull",
    "primary": "quads",
    "secondary": [
      "hamstrings",
      "glutes",
      "calves",
      "lowerback"
    ],
    "equipment": "Barbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "belt-squat",
    "name": "Belt Squat",
    "primary": "quads",
    "secondary": [
      "glutes"
    ],
    "equipment": "Machine",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "hip-adduction-machine",
    "name": "Hip Adduction Machine",
    "primary": "quads",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "landmine-squat",
    "name": "Landmine Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "heel-elevated-goblet-squat",
    "name": "Heel-Elevated Goblet Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "front-foot-elevated-split-squat",
    "name": "Front-Foot Elevated Split Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "smith-machine-bulgarian-split-squat",
    "name": "Smith Machine Bulgarian Split Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Machine",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "smith-machine-reverse-lunge",
    "name": "Smith Machine Reverse Lunge",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "reverse-lunge",
    "name": "Reverse Lunge",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "dumbbell-lateral-lunge",
    "name": "Dumbbell Lateral Lunge",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "wall-sit",
    "name": "Wall Sit",
    "primary": "quads",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "burpee",
    "name": "Burpee",
    "primary": "quads",
    "secondary": [
      "chest",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "high-knees",
    "name": "High Knees",
    "primary": "quads",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "jumping-jack",
    "name": "Jumping Jack",
    "primary": "quads",
    "secondary": [
      "shoulders",
      "calves"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "skater-hop",
    "name": "Skater Hop",
    "primary": "quads",
    "secondary": [
      "glutes",
      "calves"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "lateral-shuffle",
    "name": "Lateral Shuffle",
    "primary": "quads",
    "secondary": [
      "glutes",
      "calves"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "sprawl",
    "name": "Sprawl",
    "primary": "quads",
    "secondary": [
      "abdomen",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "pistol-squat",
    "name": "Pistol Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "assisted-pistol-squat",
    "name": "Assisted Pistol Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "shrimp-squat",
    "name": "Shrimp Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "skater-squat",
    "name": "Skater Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "single-leg-box-squat",
    "name": "Single-Leg Box Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "banded-squat",
    "name": "Banded Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "standing-quad-stretch",
    "name": "Standing Quad Stretch",
    "primary": "quads",
    "secondary": [
      "glutes",
      "back"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "running",
    "name": "Treadmill Run",
    "primary": "quads",
    "secondary": [
      "calves",
      "glutes"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "walking",
    "name": "Treadmill Walk",
    "primary": "quads",
    "secondary": [
      "calves",
      "glutes"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "treadmill-incline-walk",
    "name": "Treadmill Incline Walk",
    "primary": "quads",
    "secondary": [
      "glutes",
      "calves"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "hiking",
    "name": "Vertical Climber",
    "primary": "quads",
    "secondary": [
      "glutes",
      "calves"
    ],
    "equipment": "Machine",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "cycling",
    "name": "Stationary Bike",
    "primary": "quads",
    "secondary": [
      "calves",
      "glutes"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "assault-bike",
    "name": "Air Bike",
    "primary": "quads",
    "secondary": [
      "shoulders",
      "back"
    ],
    "equipment": "Machine",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "elliptical",
    "name": "Elliptical Trainer",
    "primary": "quads",
    "secondary": [
      "glutes",
      "calves"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "fy7Tgy4",
    "name": "Dumbbell Alternate Hammer Preacher Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "IENzBdA",
    "name": "Barbell Drag Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "NlfIbzq",
    "name": "Dumbbell Alternate Preacher Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "G08RZcQ",
    "name": "Cable Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "WLvTAv5",
    "name": "Barbell Prone Incline Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "Zwiw7XR",
    "name": "Dumbbell Alternating Bicep Curl with Leg Raised on Exercise Ball",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "HPlPoQA",
    "name": "Cable Hammer Curl (With Rope)",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "xNrS20v",
    "name": "Barbell Reverse Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "J74XlNf",
    "name": "Dumbbell Alternating Seated Bicep Curl on Exercise Ball",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "otqIxU4",
    "name": "Cable Lying Bicep Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "61GrD55",
    "name": "Cable Lying Close-grip Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "1V1gj1u",
    "name": "Barbell Seated Close-grip Concentration Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "2NImIAG",
    "name": "Dumbbell Bicep Curl on Exercise Ball with Leg Raised",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "4dUn2iv",
    "name": "Barbell Standing Close Grip Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "incline-dumbbell-curl",
    "name": "Incline Dumbbell Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "J6Dx1Mu",
    "name": "Barbell Close-grip Bench Press",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "7jGOBF3",
    "name": "Dumbbell Close Grip Press",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "RrLske5",
    "name": "Bench Dip (Knees Bent)",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "MU9HnE7",
    "name": "Weighted Bench Dip",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "LMGXZn8",
    "name": "Barbell Decline Close Grip to Skull Press",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "Db7eEgw",
    "name": "Cable Concentration Extension (On Knee)",
    "primary": "triceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "Ser9eQp",
    "name": "Machine Triceps Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "WcHl7ru",
    "name": "Smith Close-grip Bench Press",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "bZq4bwK",
    "name": "Weighted Tricep Dips",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "OTgkHwR",
    "name": "Dumbbell Decline Triceps Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "Hx1WC8I",
    "name": "Cable Incline Triceps Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "ZsiqXYa",
    "name": "JM Press",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "HEJ6DIX",
    "name": "Dumbbell Triceps Kickback",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "x6KpKpq",
    "name": "Close-grip Push-up",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "yg8Totb",
    "name": "Barbell Lying Back of the Head Tricep Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "rope-tricep-pushdown",
    "name": "Rope Tricep Pushdown",
    "primary": "triceps",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "single-dumbbell-skullcrusher",
    "name": "Single Dumbbell Skullcrusher",
    "primary": "triceps",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "single-arm-dumbbell-tricep-extension",
    "name": "Single Arm Dumbbell Tricep Extension",
    "primary": "triceps",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "chair-dip",
    "name": "Chair Dip",
    "primary": "triceps",
    "secondary": [
      "chest",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "crab-walk",
    "name": "Crab Walk",
    "primary": "triceps",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "mnzcrIB",
    "name": "Dumbbell Bench Squat",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "1bQkKZK",
    "name": "Smith Good Morning",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "lowerback"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "GWoKnIm",
    "name": "Weighted Cossack Squats",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Weighted",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "Kpajagk",
    "name": "Cable Standing Hip Extension",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "UfePqpx",
    "name": "Smith Romanian Deadlift",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "lowerback"
    ],
    "equipment": "Machine",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "BbfB8Gb",
    "name": "Basic Toe Touch",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "ecl28tP",
    "name": "Dumbbell Contralateral Forward Lunge",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "u27Kcdz",
    "name": "Bench Hip Extension",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "vR1vold",
    "name": "Zercher Squat",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "nUwVh7b",
    "name": "Dumbbell Romanian Deadlift",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "lowerback"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "NNoHCEA",
    "name": "Smith Full Squat",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "ZuPXtCK",
    "name": "Smith Hack Squat",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "wfotm7S",
    "name": "Bodyweight Drop Jump Squat",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "5VCj6iH",
    "name": "Barbell Hack Squat",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "hip-thrust",
    "name": "Hip Thrust",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "dumbbell-hip-thrust",
    "name": "Dumbbell Hip Thrust",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "glute-bridge",
    "name": "Glute Bridge",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "single-leg-glute-bridge",
    "name": "Single-Leg Glute Bridge",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "dumbbell-glute-bridge",
    "name": "Dumbbell Glute Bridge",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "abdomen"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "glute-bridge-march",
    "name": "Glute Bridge March",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "trap-bar-deadlift",
    "name": "Trap Bar Deadlift",
    "primary": "glutes",
    "secondary": [
      "quads",
      "forearm",
      "lowerback"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "hip-abduction-machine",
    "name": "Hip Abduction Machine",
    "primary": "glutes",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "machine-glute-kickback",
    "name": "Machine Glute Kickback",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "cable-standing-hip-abduction",
    "name": "Cable Standing Hip Abduction",
    "primary": "glutes",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "reverse-hyperextension",
    "name": "Reverse Hyperextension",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "lowerback"
    ],
    "equipment": "Machine",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "dumbbell-sumo-deadlift",
    "name": "Dumbbell Sumo Deadlift",
    "primary": "glutes",
    "secondary": [
      "quads",
      "lowerback"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "dumbbell-sumo-squat",
    "name": "Dumbbell Sumo Squat",
    "primary": "glutes",
    "secondary": [
      "quads",
      "hamstrings"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "deficit-reverse-lunge",
    "name": "Deficit Reverse Lunge",
    "primary": "glutes",
    "secondary": [
      "quads",
      "hamstrings"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "dumbbell-curtsy-lunge",
    "name": "Dumbbell Curtsy Lunge",
    "primary": "glutes",
    "secondary": [
      "quads",
      "hamstrings"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "curtsy-lunge",
    "name": "Curtsy Lunge",
    "primary": "glutes",
    "secondary": [
      "quads",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "frog-pump",
    "name": "Frog Pump",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "donkey-kick",
    "name": "Donkey Kick",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "fire-hydrant",
    "name": "Fire Hydrant",
    "primary": "glutes",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "clamshell",
    "name": "Clamshell",
    "primary": "glutes",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "hip-airplane",
    "name": "Hip Airplane",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "side-lying-leg-raise",
    "name": "Side-Lying Leg Raise",
    "primary": "glutes",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-glute-bridge",
    "name": "Banded Glute Bridge",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "abdomen"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-hip-thrust",
    "name": "Banded Hip Thrust",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "abdomen"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-frog-pump",
    "name": "Banded Frog Pump",
    "primary": "glutes",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-clamshell",
    "name": "Banded Clamshell",
    "primary": "glutes",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-lateral-walk",
    "name": "Banded Lateral Walk",
    "primary": "glutes",
    "secondary": [
      "quads",
      "abdomen"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-monster-walk",
    "name": "Banded Monster Walk",
    "primary": "glutes",
    "secondary": [
      "quads",
      "hamstrings"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-donkey-kick",
    "name": "Banded Donkey Kick",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "abdomen"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-fire-hydrant",
    "name": "Banded Fire Hydrant",
    "primary": "glutes",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-kickback",
    "name": "Banded Kickback",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "abdomen"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-standing-hip-abduction",
    "name": "Banded Standing Hip Abduction",
    "primary": "glutes",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "banded-seated-hip-abduction",
    "name": "Banded Seated Hip Abduction",
    "primary": "glutes",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kneeling-hip-flexor-stretch",
    "name": "Kneeling Hip Flexor Stretch",
    "primary": "glutes",
    "secondary": [
      "quads",
      "back"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "butterfly-stretch",
    "name": "Butterfly Stretch",
    "primary": "glutes",
    "secondary": [
      "quads",
      "back"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "stair-climber",
    "name": "Stair Climber",
    "primary": "glutes",
    "secondary": [
      "quads",
      "calves"
    ],
    "equipment": "Machine",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "IeDEXTe",
    "name": "Leg Press Calf Raise",
    "primary": "calves",
    "secondary": [
      "hamstrings",
      "glutes"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "LmaFNZS",
    "name": "Weighted Donkey Calf Raise",
    "primary": "calves",
    "secondary": [
      "hamstrings",
      "glutes"
    ],
    "equipment": "Weighted",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "ykUOVze",
    "name": "Lever Standing Calf Raise",
    "primary": "calves",
    "secondary": [],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "bJYHBIN",
    "name": "Bodyweight Standing Calf Raise",
    "primary": "calves",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "6HiHHe0",
    "name": "Barbell Standing Rocking Leg Calf Raise",
    "primary": "calves",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "iPm26QU",
    "name": "Step-down",
    "primary": "calves",
    "secondary": [
      "hamstrings",
      "glutes"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "VW88JNd",
    "name": "Dumbbell Seated One Leg Calf Raise",
    "primary": "calves",
    "secondary": [
      "hamstrings",
      "glutes"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "ywaNfuh",
    "name": "Smith Calf Raise",
    "primary": "calves",
    "secondary": [
      "hamstrings"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "u5ESqzH",
    "name": "Donkey Calf Raise",
    "primary": "calves",
    "secondary": [
      "hamstrings",
      "glutes"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "1kB3Wmk",
    "name": "Dumbbell Single Leg Calf Raise",
    "primary": "calves",
    "secondary": [],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "0jp9Rlz",
    "name": "One Leg Floor Calf Raise",
    "primary": "calves",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "wall-calf-stretch",
    "name": "Wall Calf Stretch",
    "primary": "calves",
    "secondary": [
      "back"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "jump-rope",
    "name": "Jump Rope",
    "primary": "calves",
    "secondary": [
      "quads",
      "shoulders"
    ],
    "equipment": "Other",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "band-calf-raise",
    "name": "Band Calf Raise",
    "primary": "calves",
    "secondary": [],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "LsZkfU6",
    "name": "Barbell Reverse Wrist Curl",
    "primary": "forearm",
    "secondary": [
      "biceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "82LxxkW",
    "name": "Barbell Wrist Curl",
    "primary": "forearm",
    "secondary": [
      "biceps"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "Eg98Ft9",
    "name": "Cable Shrug",
    "primary": "trapezius",
    "secondary": [],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "7xeukSt",
    "name": "Scapula Dips",
    "primary": "trapezius",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "uTBt1HV",
    "name": "Scapular Pull-up",
    "primary": "trapezius",
    "secondary": [
      "biceps"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "OUQ0ZyW",
    "name": "Smith Shrug",
    "primary": "trapezius",
    "secondary": [],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "FkBIE6a",
    "name": "Dumbbell Lying Leg Curl",
    "primary": "hamstrings",
    "secondary": [
      "glutes"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "LNE3wfo",
    "name": "Towel Hamstring Stretch",
    "primary": "hamstrings",
    "secondary": [
      "glutes"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "C5jncD2",
    "name": "Lying Leg Curl",
    "primary": "hamstrings",
    "secondary": [
      "glutes"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "seated-leg-curl",
    "name": "Seated Leg Curl",
    "primary": "hamstrings",
    "secondary": [
      "calves"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kettlebell-romanian-deadlift",
    "name": "Kettlebell Romanian Deadlift",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "lowerback"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "single-leg-romanian-deadlift",
    "name": "Single-Leg Romanian Deadlift",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "landmine-romanian-deadlift",
    "name": "Landmine Romanian Deadlift",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "lowerback"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "lying-hamstring-walkout",
    "name": "Lying Hamstring Walkout",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "stability-ball-hamstring-curl",
    "name": "Stability Ball Hamstring Curl",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Other",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "hamstring-stretch",
    "name": "Hamstring Stretch",
    "primary": "hamstrings",
    "secondary": [
      "calves",
      "back"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "seated-forward-fold-stretch",
    "name": "Seated Forward Fold",
    "primary": "hamstrings",
    "secondary": [
      "back",
      "calves"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kettlebell-swing",
    "name": "Kettlebell Swing",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "lowerback"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "kettlebell-goblet-squat",
    "name": "Kettlebell Goblet Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kettlebell-front-squat",
    "name": "Kettlebell Front Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "kettlebell-sumo-deadlift",
    "name": "Kettlebell Sumo Deadlift",
    "primary": "glutes",
    "secondary": [
      "hamstrings",
      "lowerback"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kettlebell-single-leg-deadlift",
    "name": "Kettlebell Single-Leg Deadlift",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "lowerback"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "kettlebell-reverse-lunge",
    "name": "Kettlebell Reverse Lunge",
    "primary": "quads",
    "secondary": [
      "glutes"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kettlebell-single-arm-row",
    "name": "Kettlebell Single-Arm Row",
    "primary": "back",
    "secondary": [
      "biceps"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kettlebell-overhead-press",
    "name": "Kettlebell Overhead Press",
    "primary": "shoulders",
    "secondary": [
      "triceps"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "kettlebell-push-press",
    "name": "Kettlebell Push Press",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "quads"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "kettlebell-high-pull",
    "name": "Kettlebell High Pull",
    "primary": "trapezius",
    "secondary": [
      "shoulders",
      "glutes"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "kettlebell-shrug",
    "name": "Kettlebell Shrug",
    "primary": "trapezius",
    "secondary": [],
    "equipment": "Kettlebell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kettlebell-farmer-carry",
    "name": "Kettlebell Farmer Carry",
    "primary": "forearm",
    "secondary": [
      "trapezius",
      "abdomen"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kettlebell-overhead-tricep-extension",
    "name": "Kettlebell Overhead Triceps Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Kettlebell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "kettlebell-russian-twist",
    "name": "Kettlebell Russian Twist",
    "primary": "obliques",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Kettlebell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "kettlebell-side-bend",
    "name": "Kettlebell Side Bend",
    "primary": "obliques",
    "secondary": [],
    "equipment": "Kettlebell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "rNG1dip",
    "name": "Ring Dip",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "Rings",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "rNG2pus",
    "name": "Ring Push-Up",
    "primary": "chest",
    "secondary": [
      "triceps",
      "abdomen"
    ],
    "equipment": "Rings",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "rNG3fly",
    "name": "Ring Chest Fly",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "abdomen"
    ],
    "equipment": "Rings",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "rNG4tri",
    "name": "Ring Triceps Extension",
    "primary": "triceps",
    "secondary": [
      "chest",
      "abdomen"
    ],
    "equipment": "Rings",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "cable-lying-triceps-extension",
    "name": "Cable Lying Triceps Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Cable",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "single-arm-cable-pushdown",
    "name": "Single-Arm Cable Pushdown",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "barbell-incline-triceps-extension",
    "name": "Barbell Incline Triceps Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "dumbbell-lying-triceps-extension",
    "name": "Dumbbell Lying Triceps Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "reverse-grip-triceps-pushdown",
    "name": "Reverse-Grip Triceps Pushdown",
    "primary": "triceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "barbell-seated-overhead-triceps-extension",
    "name": "Barbell Seated Overhead Triceps Extension",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "tate-press",
    "name": "Dumbbell Tate Press",
    "primary": "triceps",
    "secondary": [
      "chest"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "v-bar-pushdown",
    "name": "V-Bar Triceps Pushdown",
    "primary": "triceps",
    "secondary": [],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "rNG5pul",
    "name": "Ring Pull-Up",
    "primary": "back",
    "secondary": [
      "biceps",
      "shoulders"
    ],
    "equipment": "Rings",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "rNG6chi",
    "name": "Ring Chin-Up",
    "primary": "biceps",
    "secondary": [
      "back",
      "shoulders"
    ],
    "equipment": "Rings",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "rNG7row",
    "name": "Ring Inverted Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "abdomen"
    ],
    "equipment": "Rings",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "rNG8fac",
    "name": "Ring Face Pull",
    "primary": "shoulders",
    "secondary": [
      "back",
      "trapezius"
    ],
    "equipment": "Rings",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "rNG9cur",
    "name": "Ring Biceps Curl",
    "primary": "biceps",
    "secondary": [
      "back",
      "abdomen"
    ],
    "equipment": "Rings",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "cable-preacher-curl",
    "name": "Cable Preacher Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "cross-body-hammer-curl",
    "name": "Cross-Body Hammer Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "seated-dumbbell-curl",
    "name": "Seated Dumbbell Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "single-arm-cable-curl",
    "name": "Single-Arm Cable Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "dumbbell-preacher-curl",
    "name": "Dumbbell Preacher Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "wide-grip-barbell-curl",
    "name": "Wide-Grip Barbell Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Barbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "zottman-curl",
    "name": "Zottman Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "machine-biceps-curl",
    "name": "Machine Biceps Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "dumbbell-reverse-curl",
    "name": "Dumbbell Reverse Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "band-biceps-curl",
    "name": "Band Biceps Curl",
    "primary": "biceps",
    "secondary": [
      "forearm"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "rNGaham",
    "name": "Ring Hamstring Curl",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Rings",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "rNGbrol",
    "name": "Ring Ab Rollout",
    "primary": "abdomen",
    "secondary": [
      "shoulders",
      "back"
    ],
    "equipment": "Rings",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "rNGclsi",
    "name": "Ring L-Sit",
    "primary": "abdomen",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "Rings",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "rNGdsup",
    "name": "Ring Support Hold",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "abdomen"
    ],
    "equipment": "Rings",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "rNGemus",
    "name": "Ring Muscle-Up",
    "primary": "back",
    "secondary": [
      "chest",
      "triceps",
      "shoulders"
    ],
    "equipment": "Rings",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "plank-hold",
    "name": "Plank",
    "primary": "abdomen",
    "secondary": [
      "shoulders",
      "glutes"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "bench-leg-raise",
    "name": "Bench Leg Raise",
    "primary": "abdomen",
    "secondary": [
      "quads"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "side-plank-hold",
    "name": "Side Plank",
    "primary": "obliques",
    "secondary": [
      "abdomen",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "cross-body-crunch",
    "name": "Cross-Body Crunch",
    "primary": "obliques",
    "secondary": [
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "dead-hang-hold",
    "name": "Dead Hang",
    "primary": "forearm",
    "secondary": [
      "back",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "outdoor-run",
    "name": "Outdoor Run",
    "primary": "quads",
    "secondary": [
      "hamstrings",
      "calves",
      "glutes"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "outdoor-cycling",
    "name": "Outdoor Cycling",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Other",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "outdoor-walk",
    "name": "Walk",
    "primary": "quads",
    "secondary": [
      "calves",
      "glutes"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "outdoor-hike",
    "name": "Hiking",
    "primary": "glutes",
    "secondary": [
      "quads",
      "calves",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "swim",
    "name": "Swimming",
    "primary": "back",
    "secondary": [
      "shoulders",
      "chest",
      "triceps"
    ],
    "equipment": "Other",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "leg-extension",
    "name": "Leg Extension",
    "primary": "quads",
    "secondary": [],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "wrist-prep",
    "name": "Wrist Prep",
    "primary": "forearm",
    "secondary": [],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "arch-hang",
    "name": "Arch Hang",
    "primary": "back",
    "secondary": [
      "shoulders",
      "forearm"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "parallel-bar-support-hold",
    "name": "Parallel Bar Support Hold",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "chest"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "smith-upright-row",
    "name": "Smith Upright Row",
    "primary": "shoulders",
    "secondary": [
      "trapezius",
      "biceps"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "cable-upright-row",
    "name": "Cable Upright Row",
    "primary": "shoulders",
    "secondary": [
      "trapezius",
      "biceps"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "dumbbell-upright-row",
    "name": "Dumbbell Upright Row",
    "primary": "shoulders",
    "secondary": [
      "trapezius",
      "biceps"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "band-upright-row",
    "name": "Band Upright Row",
    "primary": "shoulders",
    "secondary": [
      "trapezius"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "cable-bent-over-rear-delt-raise",
    "name": "Cable Bent-over Rear Delt Raise",
    "primary": "shoulders",
    "secondary": [
      "back",
      "trapezius"
    ],
    "equipment": "Cable",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "band-reverse-fly",
    "name": "Band Reverse Fly",
    "primary": "shoulders",
    "secondary": [
      "back"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "lying-rear-lateral-raise",
    "name": "Lying Rear Lateral Raise",
    "primary": "shoulders",
    "secondary": [
      "back"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "cable-internal-rotation",
    "name": "Cable Internal Rotation",
    "primary": "shoulders",
    "secondary": [
      "chest"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "single-arm-dumbbell-shoulder-press",
    "name": "Single-Arm Dumbbell Shoulder Press",
    "primary": "shoulders",
    "secondary": [
      "triceps",
      "abdomen"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "assisted-squat",
    "name": "Assisted Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "bulgarian-split-squat",
    "name": "Bulgarian Split Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "beginner-shrimp-squat",
    "name": "Beginner Shrimp Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "intermediate-shrimp-squat",
    "name": "Intermediate Shrimp Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "weighted-shrimp-squat",
    "name": "Weighted Shrimp Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Weighted",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "barbell-lunge",
    "name": "Barbell Lunge",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "barbell-reverse-lunge",
    "name": "Barbell Reverse Lunge",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings",
      "calves"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "dumbbell-squat",
    "name": "Dumbbell Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "barbell-step-up",
    "name": "Barbell Step-up",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Barbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "hack-squat-machine",
    "name": "Hack Squat",
    "primary": "quads",
    "secondary": [
      "glutes",
      "hamstrings"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "negative-dip",
    "name": "Negative Dip",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "bodyweight-romanian-deadlift",
    "name": "Bodyweight Romanian Deadlift",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "lowerback"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "bodyweight-single-leg-deadlift",
    "name": "Bodyweight Single-Leg Deadlift",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "abdomen"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "banded-nordic-curl-negative",
    "name": "Banded Nordic Curl Negative",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "calves"
    ],
    "equipment": "Band",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "banded-nordic-curl",
    "name": "Banded Nordic Curl",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "calves"
    ],
    "equipment": "Band",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "nordic-curl",
    "name": "Nordic Curl",
    "primary": "hamstrings",
    "secondary": [
      "glutes",
      "calves"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "vertical-row",
    "name": "Vertical Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "incline-row",
    "name": "Incline Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "wide-row",
    "name": "Wide Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "trapezius"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "weighted-inverted-row",
    "name": "Weighted Inverted Row",
    "primary": "back",
    "secondary": [
      "biceps",
      "forearm"
    ],
    "equipment": "Weighted",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "reverse-grip-lat-pulldown",
    "name": "Reverse-Grip Lat Pulldown",
    "primary": "back",
    "secondary": [
      "biceps"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "straight-arm-pulldown",
    "name": "Straight-Arm Pulldown",
    "primary": "back",
    "secondary": [
      "triceps",
      "abdomen"
    ],
    "equipment": "Cable",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "pseudo-planche-push-up",
    "name": "Pseudo Planche Push-up",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "triceps"
    ],
    "equipment": "Bodyweight",
    "difficulty": "Advanced",
    "mode": ""
  },
  {
    "id": "band-chest-fly",
    "name": "Band Chest Fly",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "biceps"
    ],
    "equipment": "Band",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "flat-bench-cable-fly",
    "name": "Flat Bench Cable Fly",
    "primary": "chest",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Cable",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "incline-dumbbell-hammer-press",
    "name": "Incline Dumbbell Hammer Press",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "incline-dumbbell-fly",
    "name": "Incline Dumbbell Fly",
    "primary": "chest",
    "secondary": [
      "shoulders"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "single-arm-dumbbell-bench-press",
    "name": "Single-Arm Dumbbell Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders",
      "abdomen"
    ],
    "equipment": "Dumbbell",
    "difficulty": "Intermediate",
    "mode": ""
  },
  {
    "id": "smith-incline-bench-press",
    "name": "Smith Incline Bench Press",
    "primary": "chest",
    "secondary": [
      "shoulders",
      "triceps"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "decline-chest-press-machine",
    "name": "Decline Chest Press Machine",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "Machine",
    "difficulty": "Beginner",
    "mode": ""
  },
  {
    "id": "reverse-grip-bench-press",
    "name": "Barbell Reverse-Grip Bench Press",
    "primary": "chest",
    "secondary": [
      "triceps",
      "shoulders"
    ],
    "equipment": "Barbell",
    "difficulty": "Advanced",
    "mode": ""
  }
];
