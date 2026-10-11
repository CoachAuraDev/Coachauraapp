import type { CatalogExercise } from "./catalog.ts";
import { kExercises } from "./catalog.ts";
import { fromDisplay, SET_KINDS, type Unit } from "./engine.ts";
import type { Client, Draft, Routine } from "./models.ts";

export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;
export type SavedFloor = {
  clients: Client[];
  custom: CatalogExercise[];
  templates: Routine[];
  draft: Draft | null;
  unit: Unit;
};
export type BackupPreview = {
  data: SavedFloor;
  clients: number;
  sessions: number;
  templates: number;
  custom: number;
  hasDraft: boolean;
  legacy: boolean;
};
export type BackupResult = { ok: true; preview: BackupPreview } | { ok: false; error: string };

type RecordValue = Record<string, unknown>;
function record(v: unknown, path: string): RecordValue {
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error(`${path}: expected an object.`);
  return v as RecordValue;
}
function list(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) throw new Error(`${path}: expected a list.`);
  return v;
}
function text(v: unknown, path: string, empty = false): string {
  if (typeof v !== "string" || (!empty && !v.trim())) throw new Error(`${path}: expected text.`);
  return v;
}
function id(v: unknown, path: string): string {
  const value = text(v, path);
  if (["__proto__", "prototype", "constructor"].includes(value)) throw new Error(`${path}: unsafe identifier.`);
  return value;
}
function number(v: unknown, path: string, min = 0, max = Infinity, integer = false): number {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max || (integer && !Number.isInteger(v))) {
    throw new Error(`${path}: invalid numeric value.`);
  }
  return v;
}
function nullable(v: unknown, path: string, max = Infinity): void {
  if (v !== null) number(v, path, 0, max);
}
export function validCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}
function date(v: unknown, path: string): void {
  if (!validCalendarDate(v)) throw new Error(`${path}: invalid calendar date.`);
}
function unique(items: RecordValue[], path: string): void {
  const ids = items.map((item, index) => id(item.id, `${path}[${index}].id`));
  if (new Set(ids).size !== ids.length) throw new Error(`${path}: duplicate identifiers.`);
}
function objects(v: unknown, path: string): RecordValue[] {
  const items = list(v, path).map((item, index) => record(item, `${path}[${index}]`));
  unique(items, path);
  return items;
}
function set(v: unknown, path: string): void {
  const s = record(v, path);
  id(s.id, `${path}.id`);
  number(s.reps, `${path}.reps`, 0, Infinity, true);
  number(s.weight, `${path}.weight`);
  nullable(s.rpe, `${path}.rpe`, 10);
  if (!SET_KINDS.includes(s.kind as never)) throw new Error(`${path}.kind: unsupported set type.`);
}
function exercises(v: unknown, path: string): void {
  objects(v, path).forEach((e, index) => {
    const p = `${path}[${index}]`;
    text(e.name, `${p}.name`);
    text(e.primary, `${p}.primary`);
    text(e.equipment, `${p}.equipment`);
    objects(e.sets, `${p}.sets`).forEach((s, i) => set(s, `${p}.sets[${i}]`));
  });
}
function routines(v: unknown, path: string): Routine[] {
  return objects(v, path).map((r, index) => {
    const p = `${path}[${index}]`;
    text(r.name, `${p}.name`);
    text(r.group, `${p}.group`, true);
    const ids = list(r.exerciseIds, `${p}.exerciseIds`).map((v, i) => id(v, `${p}.exerciseIds[${i}]`));
    if (new Set(ids).size !== ids.length) throw new Error(`${p}: duplicate exercise identifiers.`);
    const counts = record(r.sets, `${p}.sets`);
    for (const [key, count] of Object.entries(counts)) {
      if (!ids.includes(key)) throw new Error(`${p}.sets: unknown exercise ${key}.`);
      number(count, `${p}.sets.${key}`, 1, Infinity, true);
    }
    // These fields were added after the original SetStack routine format.
    const plan = record(r.plan === undefined ? {} : r.plan, `${p}.plan`);
    const rest = record(r.rest === undefined ? {} : r.rest, `${p}.rest`);
    for (const [key, seconds] of Object.entries(rest)) {
      if (!ids.includes(key)) throw new Error(`${p}.rest: unknown exercise ${key}.`);
      number(seconds, `${p}.rest.${key}`);
    }
    for (const [key, rows] of Object.entries(plan)) {
      if (!ids.includes(key)) throw new Error(`${p}.plan: unknown exercise ${key}.`);
      list(rows, `${p}.plan.${key}`).forEach((value, i) => {
        const row = record(value, `${p}.plan.${key}[${i}]`);
        nullable(row.reps, `${p}.plan.${key}[${i}].reps`);
        if (row.reps != null) number(row.reps, `${p}.plan.${key}[${i}].reps`, 0, Infinity, true);
        nullable(row.weightKg, `${p}.plan.${key}[${i}].weightKg`);
        if (!SET_KINDS.includes(row.kind as never)) throw new Error(`${p}.plan: unsupported set type.`);
      });
    }
    return { ...r, plan, rest } as unknown as Routine;
  });
}

/** Validate without filtering, rounding, writing or changing the caller's objects. */
export function validateSavedFloor(value: unknown): SavedFloor {
  const floor = record(structuredClone(value), "workspace");
  if (floor.unit !== "kg" && floor.unit !== "lb") throw new Error("workspace.unit: expected kg or lb.");
  const custom = objects(floor.custom === undefined ? [] : floor.custom, "custom").map((e, i) => {
    const p = `custom[${i}]`;
    for (const key of ["name", "primary", "equipment", "difficulty"]) text(e[key], `${p}.${key}`);
    text(e.mode, `${p}.mode`, true);
    list(e.secondary === undefined ? [] : e.secondary, `${p}.secondary`).forEach((v, j) => text(v, `${p}.secondary[${j}]`));
    if (e.muscleMappingExplicit !== undefined && typeof e.muscleMappingExplicit !== "boolean") throw new Error(`${p}: invalid mapping flag.`);
    return { ...e, secondary: e.secondary ?? [] } as unknown as CatalogExercise;
  });
  const catalogIds = new Set(kExercises.map((e) => e.id));
  if (custom.some((e) => catalogIds.has(e.id))) throw new Error("Custom exercise identifier conflicts with the built-in library.");
  const knownExercises = new Set([...catalogIds, ...custom.map((e) => e.id)]);
  const templates = routines(floor.templates === undefined ? [] : floor.templates, "templates");
  const clients = objects(floor.clients, "clients").map((c, i) => {
    const p = `clients[${i}]`;
    text(c.name, `${p}.name`);
    if (c.sex !== "male" && c.sex !== "female") throw new Error(`${p}.sex: unsupported value.`);
    number(c.age, `${p}.age`);
    number(c.heightCm, `${p}.heightCm`, Number.MIN_VALUE);
    number(c.weightKg, `${p}.weightKg`);
    number(c.activity, `${p}.activity`, Number.MIN_VALUE);
    number(c.weeklyGoal, `${p}.weeklyGoal`, 1, 7, true);
    number(c.restSeconds, `${p}.restSeconds`);
    for (const key of ["neckCm", "waistCm", "hipCm"]) nullable(c[key], `${p}.${key}`);
    text(c.notes, `${p}.notes`, true);
    date(c.since, `${p}.since`);
    const assigned = routines(c.routines, `${p}.routines`);
    const assignedIds = new Set(assigned.map((r) => r.id));
    for (const [day, routineId] of Object.entries(record(c.weeklyPlan, `${p}.weeklyPlan`))) {
      if (!/^[1-7]$/.test(day) || !assignedIds.has(text(routineId, `${p}.weeklyPlan.${day}`))) {
        throw new Error(`${p}.weeklyPlan: invalid day or missing routine.`);
      }
    }
    objects(c.sessions, `${p}.sessions`).forEach((s, j) => {
      const sp = `${p}.sessions[${j}]`;
      date(s.date, `${sp}.date`);
      text(s.name, `${sp}.name`);
      number(s.durationSec, `${sp}.durationSec`);
      if (s.routineId !== null) id(s.routineId, `${sp}.routineId`);
      // A completed session may refer to a subsequently deleted routine/exercise.
      exercises(s.exercises, `${sp}.exercises`);
    });
    list(c.bodyweight, `${p}.bodyweight`).forEach((v, j) => {
      const entry = record(v, `${p}.bodyweight[${j}]`);
      date(entry.date, `${p}.bodyweight[${j}].date`);
      number(entry.kg, `${p}.bodyweight[${j}].kg`, Number.MIN_VALUE);
      if (entry.recordedAt !== undefined && (typeof entry.recordedAt !== "string" || !Number.isFinite(Date.parse(entry.recordedAt)))) {
        throw new Error(`${p}.bodyweight[${j}]: invalid timestamp.`);
      }
    });
    return { ...c, routines: assigned } as unknown as Client;
  });
  for (const r of [...templates, ...clients.flatMap((c) => c.routines)]) {
    for (const exerciseId of r.exerciseIds) {
      if (!knownExercises.has(exerciseId)) throw new Error(`Routine "${r.name}" references unavailable exercise ${exerciseId}.`);
    }
  }
  const draft = floor.draft ?? null;
  if (draft !== null) {
    const d = record(draft, "draft");
    const owner = clients.find((c) => c.id === d.clientId);
    if (!owner) throw new Error("draft: client does not exist.");
    if (d.routineId !== null && !owner.routines.some((r) => r.id === d.routineId)) throw new Error("draft: assigned routine does not exist.");
    text(d.name, "draft.name");
    number(d.startedAt, "draft.startedAt");
    nullable(d.restUntil, "draft.restUntil");
    exercises(d.exercises, "draft.exercises");
    number(d.activeIndex, "draft.activeIndex", 0, Math.max(0, list(d.exercises, "draft.exercises").length - 1), true);
    for (const [key, v] of Object.entries(record(d.entries === undefined ? {} : d.entries, "draft.entries"))) {
      id(key, "draft.entries identifier");
      const e = record(v, `draft.entries.${key}`);
      nullable(e.weightKg, `draft.entries.${key}.weightKg`);
      nullable(e.reps, `draft.entries.${key}.reps`, 100);
      if (e.reps !== null) number(e.reps, `draft.entries.${key}.reps`, 0, 100, true);
      nullable(e.rir, `draft.entries.${key}.rir`, 10);
      if (e.inputs !== undefined) {
        const input = record(e.inputs, `draft.entries.${key}.inputs`);
        for (const field of ["weight", "reps", "rir"]) text(input[field], `draft.entries.${key}.inputs.${field}`, true);
        if (input.unit !== "kg" && input.unit !== "lb") throw new Error(`draft.entries.${key}.inputs: invalid unit.`);
        if (e.weightKg !== null) {
          const displayed = Number(input.weight);
          const tolerance = fromDisplay(0.005, input.unit) + 1e-9;
          if (!(input.weight as string).trim() || !Number.isFinite(displayed) || displayed < 0 ||
            Math.abs(fromDisplay(displayed, input.unit) - (e.weightKg as number)) > tolerance) {
            throw new Error(`draft.entries.${key}.inputs: weight does not match the stored load.`);
          }
        }
        for (const field of ["reps", "rir"]) {
          if (e[field] !== null && (!(input[field] as string).trim() || Number(input[field]) !== e[field])) {
            throw new Error(`draft.entries.${key}.inputs: ${field} does not match its value.`);
          }
        }
      }
      if (e.kind !== "normal" && e.kind !== "warmup") throw new Error(`draft.entries.${key}: unsupported set type.`);
    }
    for (const key of ["restPausedSeconds", "restDurationSeconds", "restOverrideSeconds"]) {
      if (d[key] !== undefined) nullable(d[key], `draft.${key}`);
    }
    for (const key of ["timerSound", "timerVibration"]) {
      if (d[key] !== undefined && typeof d[key] !== "boolean") throw new Error(`draft.${key}: expected boolean.`);
    }
  }
  return { clients, custom, templates, unit: floor.unit, draft: draft as Draft | null };
}

export function encodeBackup(data: SavedFloor): string {
  // Keep the historical format identifier; bump the schema, not the storage key.
  const body = { app: "SetStack", version: 2, ...data };
  let encoded = JSON.stringify(body, null, 2);
  if (new TextEncoder().encode(encoded).length > MAX_BACKUP_BYTES) encoded = JSON.stringify(body);
  if (new TextEncoder().encode(encoded).length > MAX_BACKUP_BYTES) {
    throw new Error("Workspace exceeds the 20 MB portable backup limit. No incomplete backup was created.");
  }
  return encoded;
}

export function inspectBackup(raw: string, current: SavedFloor): BackupResult {
  try {
    if (new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error("Backup exceeds the 20 MB safety limit.");
    const parsed: unknown = JSON.parse(raw);
    const baseline: SavedFloor = {
      clients: current.clients, custom: current.custom, templates: current.templates,
      draft: current.draft, unit: current.unit,
    };
    let legacy = true;
    let candidate: unknown;
    if (Array.isArray(parsed)) {
      candidate = { ...baseline, clients: parsed, draft: null };
    } else {
      const body = record(parsed, "backup");
      if (!["SetStack", "CoachAura"].includes(body.app as string) || ![1, 2].includes(body.version as number)) {
        throw new Error("Unsupported backup application or version. Use a SetStack/CoachAura version 1 or 2 backup.");
      }
      legacy = body.version === 1;
      if (!legacy) {
        for (const key of ["clients", "custom", "templates", "unit", "draft"]) {
          if (!(key in body)) throw new Error(`Version 2 backup is missing ${key}.`);
        }
      }
      candidate = legacy
        ? { ...baseline, clients: body.clients, custom: "custom" in body ? body.custom : current.custom, templates: "templates" in body ? body.templates : current.templates, draft: null }
        : body;
    }
    const data = validateSavedFloor(candidate);
    return { ok: true, preview: {
      data, legacy, clients: data.clients.length, custom: data.custom.length, templates: data.templates.length,
      sessions: data.clients.reduce((n, c) => n + c.sessions.length, 0), hasDraft: data.draft !== null,
    } };
  } catch (error) {
    return { ok: false, error: error instanceof SyntaxError ? "That file is not valid JSON." : error instanceof Error ? error.message : "Invalid backup." };
  }
}
