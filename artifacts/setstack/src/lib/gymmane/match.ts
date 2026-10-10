// Port of GymMane lib/services/exercise_match.dart (InlitX, GPL-3.0).
// See third_party/gymmane/lib/services/exercise_match.dart.

import { kExerciseAliases } from "./aliases.ts";
import { kExercises, type CatalogExercise } from "./catalog.ts";

const stop = new Set(["the", "a", "an", "with", "on", "to", "and", "or", "in", "for", "v", "var"]);

const syn: Record<string, string> = {
  lat: "lateral",
  lats: "lateral",
  bicep: "biceps",
  bicepts: "biceps",
  tricep: "triceps",
  tricepts: "triceps",
  db: "dumbbell",
  bb: "barbell",
  kb: "kettlebell",
  bw: "bodyweight",
  dumbell: "dumbbell",
  dumbells: "dumbbell",
  dumbbells: "dumbbell",
  barbells: "barbell",
  cables: "cable",
  machines: "machine",
  bands: "band",
  ohp: "overhead press",
  pushup: "push up",
  pushups: "push up",
  pullup: "pull up",
  pullups: "pull up",
  chinup: "chin up",
  chinups: "chin up",
  situp: "sit up",
  situps: "sit up",
  curls: "curl",
  rows: "row",
  presses: "press",
  ups: "up",
  downs: "down",
  climbers: "climber",
  crushers: "crusher",
  squats: "squat",
  raises: "raise",
  extensions: "extension",
  flyes: "fly",
  flies: "fly",
  flys: "fly",
  deadlifts: "deadlift",
  lunges: "lunge",
  dips: "dip",
  pulldowns: "pulldown",
  legs: "leg",
  arms: "arm",
  abs: "abdominal",
  delts: "deltoid",
  lever: "machine",
  smith: "machine",
  skullcrusher: "lying triceps extension",
  skullcrushers: "lying triceps extension",
  rdl: "romanian deadlift",
  sldl: "stiff leg deadlift",
};

const equipment = new Set([
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "smith",
  "kettlebell",
  "band",
  "bodyweight",
  "lever",
  "sled",
  "weighted",
  "assisted",
  "ez",
]);

const modifiers = new Set([
  "one",
  "single",
  "arm",
  "seated",
  "sitted",
  "standing",
  "lying",
  "alternate",
  "alternating",
  "wide",
  "close",
  "narrow",
  "grip",
  "straight",
  "bent",
  "over",
  "both",
  "two",
  "double",
  "hand",
]);

const legs = new Set(["quads", "glutes", "hamstrings", "calves"]);

const muscleHints: { needles: string[]; muscle: string }[] = [
  { needles: ["hyperextension", "back extension", "superman", "lower back", "erector", "deadlift"], muscle: "lowerback" },
  { needles: ["calf", "calves", "soleus"], muscle: "calves" },
  { needles: ["hamstring", "leg curl", "good morning", "nordic"], muscle: "hamstrings" },
  { needles: ["glute", "hip thrust", "bridge", "kickback"], muscle: "glutes" },
  { needles: ["quad", "squat", "leg press", "leg extension", "lunge", "step up", "hack"], muscle: "quads" },
  { needles: ["oblique", "twist", "side bend", "wood chop", "russian"], muscle: "obliques" },
  { needles: ["crunch", "sit up", "plank", "abdominal", "leg raise", "hollow", "v up"], muscle: "abdomen" },
  { needles: ["shrug", "trap ", "trapezius", "upright row"], muscle: "trapezius" },
  { needles: ["forearm", "wrist", "farmer", "gripper", "hand grip"], muscle: "forearm" },
  { needles: ["triceps", "pushdown", "skullcrusher", "kickback", "dip"], muscle: "triceps" },
  { needles: ["biceps", "curl", "preacher", "chin up"], muscle: "biceps" },
  { needles: ["lateral raise", "shoulder", "overhead press", "military", "arnold", "face pull", "delt", "upright"], muscle: "shoulders" },
  { needles: ["row", "pulldown", "pull up", "pullover", "lateral pull"], muscle: "back" },
  { needles: ["bench press", "chest", "fly", "pec", "push up", "press"], muscle: "chest" },
];

export function nameTokens(raw: string): string[] {
  const flat = raw
    .toLowerCase()
    .replace(/[àáâãä]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõö]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/ñ/g, "n");
  const out: string[] = [];
  for (const part of flat.split(/[^a-z0-9]+/)) {
    if (!part || stop.has(part)) continue;
    const mapped = syn[part] ?? part;
    out.push(...mapped.split(" "));
  }
  return out;
}

export function searchKey(raw: string): string {
  return nameTokens(raw).join(" ");
}

export function sortedKey(raw: string): string {
  return [...nameTokens(raw)].sort().join(" ");
}

const keyCache = new Map<string, string>();
function keyOf(name: string): string {
  let hit = keyCache.get(name);
  if (hit === undefined) {
    hit = searchKey(name);
    keyCache.set(name, hit);
  }
  return hit;
}

const aliasIndex = new Map<string, string>();
for (const [canonical, list] of Object.entries(kExerciseAliases)) {
  for (const alias of list) aliasIndex.set(sortedKey(alias), canonical);
}

export function exerciseSearch(query: string): (exercise: CatalogExercise) => boolean {
  const plain = query.trim().toLowerCase();
  if (!plain) return () => true;
  const key = searchKey(query);
  return (exercise) => {
    if (exercise.name.toLowerCase().includes(plain)) return true;
    const aliasList = kExerciseAliases[exercise.name] ?? [];
    if (aliasList.some((alias) => alias.toLowerCase().includes(plain))) return true;
    if (!key) return false;
    if (keyOf(exercise.name).includes(key)) return true;
    if (aliasList.some((alias) => keyOf(alias).includes(key))) return true;
    return false;
  };
}

function sameEquipment(query: Set<string>, candidate: Set<string>): boolean {
  const qe = new Set([...query].filter((token) => equipment.has(token)));
  const ce = new Set([...candidate].filter((token) => equipment.has(token)));
  if (qe.size === 0 || ce.size === 0) return true;
  for (const token of qe) if (ce.has(token)) return true;
  return false;
}

function fits(qCore: Set<string>, query: Set<string>, candidate: Set<string>): boolean {
  if (qCore.size > 0 && [...qCore].every((token) => candidate.has(token))) return true;
  const meaning = new Set([...candidate].filter((token) => !equipment.has(token)));
  const meaningful = [...meaning].filter((token) => !modifiers.has(token));
  return meaning.size >= 2 && meaningful.length > 0 && [...meaning].every((token) => query.has(token));
}

function sameMuscle(hint: string | null, exercise: CatalogExercise): boolean {
  if (hint == null) return true;
  if (exercise.primary === hint || exercise.secondary.includes(hint)) return true;
  if (legs.has(hint) && legs.has(exercise.primary)) return true;
  if (hint === "lowerback" && (exercise.primary === "hamstrings" || exercise.primary === "glutes")) return true;
  return false;
}

function score(query: Set<string>, candidate: Set<string>): number {
  const shared = [...query].filter((token) => candidate.has(token));
  if (shared.filter((token) => !equipment.has(token)).length === 0) return 0;
  const extraC = [...candidate].filter((token) => !query.has(token)).length;
  const extraQ = [...query].filter((token) => !candidate.has(token)).length;
  return shared.length * 3 - extraC - extraQ;
}

export function guessMuscle(name: string): string | null {
  const flat = ` ${nameTokens(name).join(" ")} `;
  for (const entry of muscleHints) {
    for (const needle of entry.needles) {
      if (flat.includes(` ${needle}`) || flat.includes(`${needle} `)) return entry.muscle;
    }
  }
  return null;
}

export function matchExercise(name: string, pool: readonly CatalogExercise[] = kExercises): CatalogExercise | null {
  const key = searchKey(name);
  if (!key) return null;

  for (const exercise of pool) {
    if (keyOf(exercise.name) === key) return exercise;
  }

  for (const exercise of pool) {
    const aliasList = kExerciseAliases[exercise.name] ?? [];
    if (aliasList.some((alias) => keyOf(alias) === key)) return exercise;
  }

  const alias = aliasIndex.get(sortedKey(name));
  if (alias) {
    const wanted = searchKey(alias);
    for (const exercise of pool) {
      if (searchKey(exercise.name) === wanted) return exercise;
    }
  }

  const query = new Set(key.split(" "));
  const qMeaning = new Set([...query].filter((token) => !equipment.has(token)));
  if (qMeaning.size === 0) return null;
  const qCore = new Set([...qMeaning].filter((token) => !modifiers.has(token)));
  const hint = guessMuscle(name);

  let exact: CatalogExercise | null = null;
  let exactExtra = 1 << 30;
  let loose: CatalogExercise | null = null;
  let looseScore = 0;

  for (const exercise of pool) {
    const candidate = new Set(nameTokens(exercise.name));
    if (candidate.size === 0 || !sameEquipment(query, candidate) || !sameMuscle(hint, exercise)) continue;
    if ([...qMeaning].every((token) => candidate.has(token))) {
      const extra = [...candidate].filter((token) => !query.has(token)).length;
      if (extra < exactExtra) {
        exact = exercise;
        exactExtra = extra;
      }
    } else if (fits(qCore, query, candidate)) {
      const value = score(query, candidate);
      if (value > looseScore) {
        loose = exercise;
        looseScore = value;
      }
    }
  }
  return exact ?? (looseScore >= 3 ? loose : null);
}

export function exerciseById(id: string, extra: readonly CatalogExercise[] = []): CatalogExercise | null {
  return extra.find((exercise) => exercise.id === id) ?? kExercises.find((exercise) => exercise.id === id) ?? null;
}
