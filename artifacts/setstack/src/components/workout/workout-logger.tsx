import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowRight, Check, ChevronDown, Copy, Dumbbell, Pencil, Plus, Trash2, X } from "lucide-react";
import { useFloor, exercisePool } from "@/lib/gymmane/store";
import { registerNativeBackHandler } from "@/lib/native/back-handlers";
import { fromDisplay, formatLoad, shortDate, toDisplay } from "@/lib/gymmane/engine";
import { personalRecords } from "@/lib/gymmane/metrics";
import { nextSetDefaults, plannedSetCount, previousExercisePerformance } from "@/lib/gymmane/workout-logging";
import type { DraftEntry, SetLog } from "@/lib/gymmane/models";
import { RestTimer } from "./rest-timer";
import { fieldClass, labelClass, primaryBtn, quietBtn, rirText, type AskConfirm } from "./shared";

type Fields = {
  kg?: number | null;
  weight: string;
  reps: string;
  rir: string;
  kind: "normal" | "warmup";
  inputWeight?: string;
  inputUnit?: "kg" | "lb";
};
const dispWeight = (kg: number | null, unit: "kg" | "lb") => (kg == null ? "" : String(Number(toDisplay(kg, unit).toFixed(2))));
const entryToFields = (e: DraftEntry, unit: "kg" | "lb"): Fields => {
  const inputWeight = e.inputs?.weight ?? dispWeight(e.weightKg, unit);
  const inputUnit = e.inputs?.unit ?? unit;
  return {
    kg: e.weightKg,
    weight: inputUnit === unit ? inputWeight : dispWeight(e.weightKg, unit),
    reps: e.inputs?.reps ?? (e.reps == null ? "" : String(e.reps)),
    rir: e.inputs?.rir ?? (e.rir == null ? "" : String(e.rir)),
    kind: e.kind,
    inputWeight,
    inputUnit,
  };
};
const pendingNumber = (value: string) => value.trim() === "" || !Number.isFinite(Number(value)) ? null : Number(value);
const fieldsToEntry = (f: Fields, unit: "kg" | "lb"): DraftEntry => {
  const kg = f.kg !== undefined ? f.kg : pendingNumber(f.weight) == null ? null : fromDisplay(Number(f.weight), unit);
  const reps = pendingNumber(f.reps), rir = pendingNumber(f.rir);
  const weightInput = f.kg !== undefined
    ? { weight: f.inputWeight ?? f.weight, unit: f.inputUnit ?? unit }
    : { weight: f.weight, unit };
  return {
    weightKg: kg != null && Number.isFinite(kg) && kg >= 0 ? kg : null,
    reps: reps != null && Number.isInteger(reps) && reps >= 0 && reps <= 100 ? reps : null,
    rir: rir != null && rir >= 0 && rir <= 10 ? rir : null,
    kind: f.kind,
    // Invalid or incomplete input is retained as text, never as training data.
    inputs: { ...weightInput, reps: f.reps, rir: f.rir },
  };
};

function SetRow({ set, index, exerciseIndex, unit }: { set: SetLog; index: number; exerciseIndex: number; unit: "kg" | "lb" }) {
  const removeSet = useFloor((s) => s.removeSet);
  const updateDraftSet = useFloor((s) => s.updateDraftSet);
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<Fields>({ weight: "", reps: "", rir: "", kind: "normal" });
  const [err, setErr] = useState("");
  const begin = () => { setF({ weight: dispWeight(set.weight, unit), reps: String(set.reps), rir: rirText(set.rpe), kind: set.kind === "warmup" ? "warmup" : "normal" }); setErr(""); setEditing(true); };
  const save = () => {
    const w = Number(f.weight === "" ? 0 : f.weight), r = Number(f.reps), rir = f.rir === "" ? null : Number(f.rir);
    if (!Number.isFinite(w) || w < 0 || !Number.isInteger(r) || r < 1 || r > 100 || (rir != null && (!Number.isFinite(rir) || rir < 0 || rir > 10))) { setErr("Check load, whole reps and RIR (0 to 10)."); return; }
    const ok = updateDraftSet(exerciseIndex, set.id, { weight: dispWeight(set.weight, unit) === f.weight ? set.weight : fromDisplay(w, unit), reps: r, rpe: f.rir === rirText(set.rpe) ? set.rpe : rir == null ? null : 10 - rir, kind: f.kind === "warmup" ? "warmup" : set.kind === "warmup" ? "normal" : set.kind });
    if (!ok) { setErr("Could not update this set."); return; }
    setEditing(false);
  };
  if (editing) return <div className="rounded-lg border border-[hsl(var(--primary))]/50 bg-[hsl(var(--background))] p-2" data-testid={`row-edit-set-${set.id}`}>
    <div className="grid grid-cols-4 gap-1.5">
      <input aria-label="Load" className={`${fieldClass} px-2 py-2`} type="number" min="0" step="any" inputMode="decimal" value={f.weight} onChange={(e) => setF({ ...f, weight: e.target.value })} data-testid={`input-edit-weight-${set.id}`}/>
      <input aria-label="Reps" className={`${fieldClass} px-2 py-2`} type="number" min="1" inputMode="numeric" value={f.reps} onChange={(e) => setF({ ...f, reps: e.target.value })} data-testid={`input-edit-reps-${set.id}`}/>
      <input aria-label="RIR" className={`${fieldClass} px-2 py-2`} type="number" min="0" max="10" step="any" inputMode="decimal" placeholder="RIR" value={f.rir} onChange={(e) => setF({ ...f, rir: e.target.value })} data-testid={`input-edit-rir-${set.id}`}/>
      <select aria-label="Set type" className={`${fieldClass} px-1 py-2`} value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value as Fields["kind"] })} data-testid={`select-edit-kind-${set.id}`}><option value="normal">Work</option><option value="warmup">Warm-up</option></select>
    </div>
    {err && <p role="alert" className="mt-1 text-xs text-[hsl(0_90%_75%)]">{err}</p>}
    <div className="mt-2 flex justify-end gap-2"><button type="button" className={`${quietBtn} min-h-11 px-4`} onClick={() => setEditing(false)} data-testid={`button-cancel-edit-set-${set.id}`}>Cancel</button><button type="button" className={`${primaryBtn} min-h-11 px-4`} onClick={save} data-testid={`button-save-edit-set-${set.id}`}><Check size={14}/>Save</button></div>
  </div>;
  return <div className="flex items-center gap-2 rounded-lg bg-[hsl(var(--background))] px-3 py-2 text-xs" data-testid={`row-set-${set.id}`}>
    <span className="mono w-6 text-[hsl(var(--muted-foreground))]">{String(index + 1).padStart(2, "0")}</span>
    <span className="flex-1 font-medium">{formatLoad(set.weight, unit)} × {set.reps}<span className="ml-2 text-[hsl(var(--muted-foreground))]">{set.kind === "warmup" ? "Warm-up" : set.rpe == null ? "" : `RIR ${rirText(set.rpe)}`}</span></span>
    <button onClick={begin} aria-label={`Edit set ${index + 1}`} className="inline-flex h-11 w-11 items-center justify-center text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid={`button-edit-set-${set.id}`}><Pencil size={14}/></button>
    <button onClick={() => removeSet(exerciseIndex, set.id)} aria-label={`Remove set ${index + 1}`} className="inline-flex h-11 w-11 items-center justify-center text-[hsl(var(--muted-foreground))]" data-testid={`button-remove-set-${set.id}`}><X size={14}/></button>
  </div>;
}

export function WorkoutDrawer({ ask }: { ask: AskConfirm }) {
  const draft = useFloor((s) => s.draft);
  const clients = useFloor((s) => s.clients);
  const unit = useFloor((s) => s.unit);
  const custom = useFloor((s) => s.custom);
  const logSet = useFloor((s) => s.logSet);
  const setActive = useFloor((s) => s.setActive);
  const setDraftEntry = useFloor((s) => s.setDraftEntry);
  const addDraftExercise = useFloor((s) => s.addDraftExercise);
  const removeDraftExercise = useFloor((s) => s.removeDraftExercise);
  const finishSession = useFloor((s) => s.finishSession);
  const discardDraft = useFloor((s) => s.discardDraft);
  const [f, setF] = useState<Fields>({ weight: "", reps: "", rir: "", kind: "normal" });
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [exerciseSearch, setExerciseSearch] = useState("");
  useEffect(() => setMinimized(false), [draft?.startedAt, draft?.clientId]);
  useEffect(() => {
    const resume = () => setMinimized(false);
    window.addEventListener("setstack:resume-workout", resume);
    return () => window.removeEventListener("setstack:resume-workout", resume);
  }, []);
  useEffect(() => draft && !minimized ? registerNativeBackHandler(() => setMinimized(true)) : undefined, [draft?.startedAt, minimized]);
  useEffect(() => {
    if (!draft || minimized) return;
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const saved = [
      [html, "overflow"],
      [body, "overflow"],
      [body, "overscroll-behavior"],
    ] as const;
    const original = saved.map(([element, property]) => ({
      element, property,
      value: element.style.getPropertyValue(property),
      priority: element.style.getPropertyPriority(property),
    }));
    html.style.setProperty("overflow", "hidden");
    body.style.setProperty("overflow", "hidden");
    body.style.setProperty("overscroll-behavior", "none");
    return () => {
      original.forEach(({ element, property, value, priority }) => {
        if (value) element.style.setProperty(property, value, priority);
        else element.style.removeProperty(property);
      });
      window.scrollTo(0, scrollY);
    };
  }, [draft?.startedAt, minimized]);

  const client = draft ? clients.find((c) => c.id === draft.clientId) : undefined;
  const routine = client?.routines.find((r) => r.id === draft?.routineId);
  const active = draft?.exercises[draft.activeIndex];
  const activeId = active?.id;
  const stored = active && draft?.entries ? draft.entries[active.id] : undefined;
  const hasStored = !!stored;

  // Load fields only when the active exercise or unit changes; typing persists via setDraftEntry.
  useEffect(() => {
    const st = useFloor.getState();
    const d = st.draft;
    const c = st.clients.find((x) => x.id === d?.clientId);
    const ex = d?.exercises[d.activeIndex];
    if (!d || !c || !ex) return;
    const r = c.routines.find((x) => x.id === d.routineId);
    const entry = d.entries?.[ex.id] ?? nextSetDefaults(c, r, ex);
    setF(entryToFields(entry, st.unit));
    setError("");
  }, [activeId, draft?.activeIndex, draft?.clientId, draft?.startedAt, unit, hasStored]);

  const previous = useMemo(() => (client && activeId ? previousExercisePerformance(client, activeId) : null), [client, activeId]);
  const recent = useMemo(() => {
    if (!client) return [] as { id: string; name: string }[];
    const seen = new Map<string, string>();
    [...client.sessions].sort((a, b) => b.date.localeCompare(a.date)).forEach((s) => s.exercises.forEach((e) => { if (!seen.has(e.id)) seen.set(e.id, e.name); }));
    return [...seen].map(([id, name]) => ({ id, name })).filter((e) => !draft?.exercises.some((x) => x.id === e.id)).slice(0, 6);
  }, [client, draft?.exercises]);

  if (!draft || !client) return null;
  const totalSets = draft.exercises.reduce((n, e) => n + e.sets.length, 0);
  if (minimized) return <button onClick={() => setMinimized(false)} className={`${primaryBtn} fixed bottom-4 right-4 z-40 shadow-xl`} data-testid="button-resume-session"><Dumbbell size={16}/>Resume workout · {totalSets} sets</button>;

  const update = (patch: Partial<Fields>) => {
    const next = { ...f, ...patch };
    setF(next);
    setError("");
    if (active) setDraftEntry(active.id, fieldsToEntry(next, unit));
  };
  const workCount = active ? active.sets.filter((s) => s.kind !== "warmup").length : 0;
  const planned = active ? plannedSetCount(routine, active.id) : 0;
  const prevWork = previous?.sets ?? [];
  const copyIndex = f.kind === "warmup" ? prevWork.length - 1 : Math.min(workCount, prevWork.length - 1);
  const copySet = (s: SetLog | undefined) => {
    if (!s) return;
    const weight = dispWeight(s.weight, unit);
    update({ kg: s.weight, weight, reps: String(s.reps), rir: rirText(s.rpe), inputWeight: weight, inputUnit: unit });
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!active) return;
    const w = f.weight === "" ? 0 : Number(f.weight), r = Number(f.reps), rir = f.rir === "" ? null : Number(f.rir);
    if (!Number.isFinite(w) || w < 0) { setError("Load must be zero or more."); return; }
    if (!Number.isInteger(r) || r < 1 || r > 100) { setError("Reps must be a whole number from 1 to 100."); return; }
    if (rir != null && (!Number.isFinite(rir) || rir < 0 || rir > 10)) { setError("RIR must be between 0 and 10."); return; }
    logSet({ reps: r, weight: f.kg != null ? f.kg : fromDisplay(w, unit), kind: f.kind, rpe: rir == null ? null : 10 - rir });
    const st = useFloor.getState();
    const d = st.draft;
    const ex = d?.exercises[d.activeIndex];
    if (d && ex) {
      const entry = nextSetDefaults(client, routine, ex);
      setDraftEntry(ex.id, entry);
      setF(entryToFields(entry, unit));
    }
    setError("");
  };
  const oldBest = active ? personalRecords(client).find((p) => p.id === active.id) : undefined;
  const pool = exercisePool();
  const mergedPool = [...pool.filter((e) => !custom.some((c) => c.id === e.id)), ...custom];
  const filtered = mergedPool.filter((e) => !draft.exercises.some((x) => x.id === e.id) && e.name.toLowerCase().includes(exerciseSearch.toLowerCase())).slice(0, 10);
  const addExercise = (ex: (typeof mergedPool)[number]) => { addDraftExercise(ex); setShowAdd(false); setExerciseSearch(""); };
  const nextEx = draft.exercises[draft.activeIndex + 1];
  const defaultRest = routine && active ? (routine.rest[active.id] ?? client.restSeconds) : client.restSeconds;

  return <section role="dialog" aria-modal="true" aria-label={`${draft.name} live workout`} className="fixed inset-0 z-50 flex h-[100dvh] min-h-0 flex-col overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))]" data-testid="panel-workout-logger">
    <header className="z-10 flex shrink-0 items-center justify-between gap-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-3 sm:px-6">
      <div className="min-w-0">
        <div className="mono break-words text-[9px] uppercase tracking-[.18em] text-[hsl(var(--chart-1))]" data-testid="text-live-client">Live session · {client.name}</div>
        <h2 className="display-font mt-0.5 truncate text-lg font-semibold sm:text-xl" data-testid="text-workout-title">{draft.name}</h2>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))]" onClick={() => setShowAdd(!showAdd)} aria-label="Add exercise" aria-expanded={showAdd} data-testid="button-logger-add-exercise"><Plus size={17}/></button>
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))]" onClick={() => setMinimized(true)} aria-label="Minimize workout without discarding it" data-testid="button-minimize-session"><ChevronDown size={17}/></button>
        <button type="button" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]" onClick={() => ask({ title: "Discard workout?", message: "Discard this unfinished workout? Every logged set will be lost.", confirmLabel: "Discard", onConfirm: () => discardDraft() })} aria-label="Discard workout" data-testid="button-discard-session"><X size={17}/></button>
      </div>
    </header>
    <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-testid="region-workout-scroll">
      <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6 sm:py-6">
        {showAdd && <div className="mb-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
          <label className={labelClass} htmlFor="logger-exercise-search">Find an exercise</label>
          <input id="logger-exercise-search" autoFocus className={fieldClass} value={exerciseSearch} onChange={(e) => setExerciseSearch(e.target.value)} placeholder="Type an exercise" data-testid="input-logger-exercise"/>
          {!exerciseSearch && recent.length > 0 && <div className="mt-2"><p className="mono mb-1 text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Recently trained</p><div className="flex flex-wrap gap-1.5">{recent.map((r) => { const ex = mergedPool.find((e) => e.id === r.id); return ex ? <button type="button" key={r.id} className="min-h-11 rounded-lg bg-[hsl(var(--muted))] px-3 text-sm font-medium" onClick={() => addExercise(ex)} data-testid={`button-logger-recent-${r.id}`}>{r.name}</button> : null; })}</div></div>}
          <div className="mt-2 max-h-40 overflow-y-auto">{filtered.length === 0 && <p className="p-2 text-xs text-[hsl(var(--muted-foreground))]">No matching exercise left to add.</p>}{filtered.map((ex) => <button type="button" key={ex.id} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[hsl(var(--muted))]" onClick={() => addExercise(ex)} data-testid={`button-logger-exercise-${ex.id}`}>{ex.name}</button>)}</div>
        </div>}
        <RestTimer defaultSeconds={defaultRest} compact/>
        {draft.exercises.length === 0 ? <div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-center"><Dumbbell className="mx-auto text-[hsl(var(--muted-foreground))]" size={24}/><p className="mt-2 text-sm font-semibold">Make this session yours</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Add the first exercise to start logging.</p><button type="button" className={`${primaryBtn} mt-3`} onClick={() => setShowAdd(true)} data-testid="button-logger-empty-add"><Plus size={15}/>Add exercise</button></div> : <>
          <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Workout exercises" data-testid="list-logger-exercises">{draft.exercises.map((ex, index) => { const p = plannedSetCount(routine, ex.id); return <button type="button" key={`${ex.id}-${index}`} onClick={() => setActive(index)} aria-current={index === draft.activeIndex} className={`shrink-0 rounded-xl px-3 py-2 text-left text-xs ${index === draft.activeIndex ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "bg-[hsl(var(--muted))]"}`} data-testid={`button-select-logger-exercise-${index}`}><span className="block max-w-40 truncate font-semibold">{ex.name}</span><span className="mono mt-1 block opacity-70">{ex.sets.length}{p ? ` / ${p}` : ""} sets</span></button>; })}</div>
          {active && <>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mono text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]" data-testid="text-exercise-progress">Exercise {draft.activeIndex + 1} of {draft.exercises.length}</p>
                <h3 className="display-font mt-1 break-words text-2xl font-semibold sm:text-3xl" data-testid="text-current-exercise">{active.name}</h3>
                <p className="mono mt-1 text-[11px] text-[hsl(var(--muted-foreground))]" data-testid="text-planned-sets">{planned > 0 ? `Set ${workCount + 1} of ${planned} planned` : `Set ${active.sets.length + 1}`} · {active.sets.length} logged</p>
                {oldBest && <p className="mt-1 text-xs text-[hsl(var(--chart-1))]" data-testid="text-logger-pr">PR {formatLoad(oldBest.e1rm, unit)} e1RM</p>}
              </div>
              <button type="button" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" onClick={() => ask({ title: "Remove exercise?", message: `Remove ${active.name} and its logged sets from this session?`, confirmLabel: "Remove", onConfirm: () => removeDraftExercise(draft.activeIndex) })} aria-label={`Remove ${active.name}`} data-testid="button-remove-draft-exercise"><Trash2 size={15}/></button>
            </div>
            <div className="mb-3 flex rounded-lg bg-[hsl(var(--muted))] p-1"><button type="button" onClick={() => update({ kind: "normal" })} className={`min-h-11 flex-1 rounded-md py-2 text-sm font-semibold ${f.kind === "normal" ? "bg-[hsl(var(--card))] shadow-sm" : ""}`} data-testid="button-set-kind-work">Work set</button><button type="button" onClick={() => update({ kind: "warmup" })} className={`min-h-11 flex-1 rounded-md py-2 text-sm font-semibold ${f.kind === "warmup" ? "bg-[hsl(var(--card))] shadow-sm" : ""}`} data-testid="button-set-kind-warmup">Warm-up</button></div>
            <form onSubmit={submit} className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3 sm:p-4" data-testid="form-log-set">
              <div className="mb-3 flex items-center justify-between"><p className="mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Current set</p><span className="mono rounded-md bg-[hsl(var(--muted))] px-2 py-1 text-[10px]" data-testid="text-current-set-number">{String(active.sets.length + 1).padStart(2, "0")}</span></div>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div><label className={labelClass} htmlFor="set-weight">Load · {unit}</label><input id="set-weight" className={`${fieldClass} min-h-12 text-base`} type="number" min="0" step="any" inputMode="decimal" value={f.weight} onChange={(e) => update({ weight: e.target.value, kg: undefined })} data-testid="input-set-weight"/></div>
                <div><label className={labelClass} htmlFor="set-reps">Reps</label><input id="set-reps" className={`${fieldClass} min-h-12 text-base`} type="number" min="1" max="100" inputMode="numeric" value={f.reps} onChange={(e) => update({ reps: e.target.value })} data-testid="input-set-reps"/></div>
                <div><label className={labelClass} htmlFor="set-rir">RIR <span className="font-normal">(optional)</span></label><input id="set-rir" className={`${fieldClass} min-h-12 text-base`} type="number" min="0" max="10" step="any" inputMode="decimal" value={f.rir} onChange={(e) => update({ rir: e.target.value })} placeholder="—" data-testid="input-set-rir"/></div>
              </div>
              {error && <p role="alert" className="mt-2 text-xs text-[hsl(0_90%_75%)]" data-testid="text-set-error">{error}</p>}
              <button type="submit" disabled={!f.reps || Number(f.reps) < 1} className={`${primaryBtn} mt-3 min-h-12 w-full`} data-testid="button-log-set"><Plus size={16}/>Log {f.kind === "warmup" ? "warm-up" : "work"} set {active.sets.length + 1}</button>
            </form>
            {nextEx && <button type="button" className={`${quietBtn} mt-2 w-full`} onClick={() => setActive(draft.activeIndex + 1)} data-testid="button-next-exercise"><ArrowRight size={15}/>Next: {nextEx.name}</button>}
            {!!active.sets.length && <section className="mt-4 space-y-1.5" aria-label="Current session sets" data-testid="list-current-sets"><div className="mb-2 flex items-center justify-between"><p className="mono text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Logged here</p><span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{active.sets.length} sets</span></div>{active.sets.map((set, index) => <SetRow key={set.id} set={set} index={index} exerciseIndex={draft.activeIndex} unit={unit}/>)}</section>}
            <section className="mt-4 rounded-xl border border-[hsl(var(--border))] p-2.5" data-testid="panel-previous-performance">
              <div className="flex items-center justify-between gap-2"><p className="mono text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">{previous ? `Previous · ${shortDate(previous.date)}` : "Previous session"}</p>{previous && prevWork.length > 0 && <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-[hsl(var(--accent))] px-3 text-xs font-bold text-[hsl(var(--primary))]" onClick={() => copySet(prevWork[copyIndex] ?? prevWork[prevWork.length - 1])} data-testid="button-copy-previous"><Copy size={12}/>Copy set {Math.min(Math.max(copyIndex, 0), prevWork.length - 1) + 1}</button>}</div>
              {previous && prevWork.length > 0 ? <div className="mt-2 flex flex-wrap gap-1.5">{prevWork.map((s, i) => <button type="button" key={s.id} onClick={() => copySet(s)} className="mono inline-flex min-h-11 items-center rounded-md bg-[hsl(var(--muted))] px-3 text-xs hover:bg-[hsl(var(--accent))]" aria-label={`Copy previous set ${i + 1}`} data-testid={`button-copy-previous-set-${i}`}>{formatLoad(s.weight, unit)} × {s.reps}{s.rpe != null ? ` · RIR ${rirText(s.rpe)}` : ""}</button>)}</div> : <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]" data-testid="text-no-previous">No earlier working sets for this athlete. Enter the first set below.</p>}
            </section>
          </>}
        </>}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[hsl(var(--border))] pt-4">
          <div><p className="mono text-[10px] text-[hsl(var(--muted-foreground))]" data-testid="text-total-sets">{totalSets} sets logged</p><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Only logged sets are saved.</p></div>
          <button type="button" disabled={totalSets === 0} className={`${primaryBtn} min-h-11 disabled:bg-[hsl(var(--muted))] disabled:text-[hsl(var(--muted-foreground))]`} onClick={() => finishSession()} data-testid="button-finish-session"><Check size={15}/>Finish workout</button>
        </div>
      </div>
    </main>
  </section>;
}
