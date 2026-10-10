import { useState, type FormEvent } from "react";
import { BookmarkPlus, Check, Plus, Trash2, X } from "lucide-react";
import { useFloor } from "@/lib/gymmane/store";
import { uid } from "@/lib/gymmane/engine";
import type { Client, PlannedSet, Routine } from "@/lib/gymmane/models";
import type { CatalogExercise } from "@/lib/gymmane/catalog";
import { CustomExerciseMuscles } from "@/components/custom-exercise-muscles";
import { Modal, fieldClass, labelClass, primaryBtn, quietBtn } from "./shared";

const blank = (reps: number | null): PlannedSet => ({ reps, weightKg: null, kind: "normal" });

export function RoutineModal({ client, routine, pool, onClose, onDelete }: { client: Client; routine?: Routine; pool: CatalogExercise[]; onClose: () => void; onDelete?: () => void }) {
  const saveRoutine = useFloor((s) => s.saveRoutine);
  const saveTemplate = useFloor((s) => s.saveTemplate);
  const setNotice = useFloor((s) => s.setNotice);
  const savedCustom = useFloor((s) => s.custom);
  const [name, setName] = useState(routine?.name ?? "");
  const [group, setGroup] = useState(routine?.group ?? "Custom");
  const [exerciseIds, setExerciseIds] = useState<string[]>(routine?.exerciseIds ?? []);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>(routine?.sets ?? {});
  const [restTimes, setRestTimes] = useState<Record<string, number>>(routine?.rest ?? {});
  const [plan, setPlan] = useState<Record<string, PlannedSet[]>>(routine?.plan ?? {});
  const [defaultReps, setDefaultReps] = useState("8");
  const available = [...pool.filter((ex) => !savedCustom.some((c) => c.id === ex.id)), ...savedCustom];
  // Preserve the routine's exercise order, not library order.
  const selected = exerciseIds.map((id) => available.find((e) => e.id === id)).filter((e): e is CatalogExercise => !!e);
  const matches = available.filter((e) => e.name.toLowerCase().includes(filter.toLowerCase()) || e.primary.toLowerCase().includes(filter.toLowerCase())).slice(0, 12);
  const dReps = Math.min(100, Math.max(1, Math.round(Number(defaultReps)) || 8));
  const countOf = (id: string) => counts[id] ?? 3;
  const planOf = (id: string): PlannedSet[] => Array.from({ length: countOf(id) }, (_, i) => plan[id]?.[i] ?? blank(null));

  const setCount = (id: string, raw: number) => {
    const n = Math.min(20, Math.max(1, Math.round(raw) || 1));
    setCounts((c) => ({ ...c, [id]: n }));
    if (plan[id]) setPlan((p) => ({ ...p, [id]: Array.from({ length: n }, (_, i) => p[id][i] ?? blank(p[id][p[id].length - 1]?.reps ?? dReps)) }));
  };
  const setRepsAt = (id: string, i: number, v: string) => {
    const reps = v === "" ? null : Math.min(100, Math.max(1, Math.round(Number(v)) || 1));
    setPlan((p) => { const cur = planOf(id).map((s, k) => (plan[id]?.[k] ? { ...plan[id][k] } : s)); cur[i] = { ...cur[i], reps }; return { ...p, [id]: cur }; });
  };
  const applyReps = (id: string) => setPlan((p) => ({ ...p, [id]: planOf(id).map((s, k) => ({ ...(p[id]?.[k] ?? s), reps: dReps })) }));
  const addExercise = (id: string) => {
    setExerciseIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    setCounts((c) => ({ ...c, [id]: c[id] ?? 3 }));
  };
  const build = (id: string): Routine | null => {
    if (!name.trim()) { setError("Give this routine a name."); return null; }
    const sets: Record<string, number> = {}, rest: Record<string, number> = {}, outPlan: Record<string, PlannedSet[]> = {};
    exerciseIds.forEach((x) => {
      sets[x] = countOf(x);
      if (restTimes[x] != null) rest[x] = restTimes[x];
      if (plan[x]) outPlan[x] = planOf(x).map((s, k) => plan[x][k] ?? s);
    });
    return { id, name: name.trim(), group: group.trim() || "Custom", exerciseIds, sets, plan: outPlan, rest };
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = build(routine?.id ?? uid());
    if (!next) return;
    saveRoutine(client.id, next);
    onClose();
  };
  const asTemplate = () => {
    if (exerciseIds.length === 0) { setError("Add at least one exercise before saving a template."); return; }
    const next = build(uid());
    if (!next) return;
    saveTemplate(next);
    setError("");
    setNotice(`Template "${next.name}" saved. Assigning it later creates an independent copy.`);
  };

  return <Modal title={routine ? "Edit routine" : "Build a routine"} onClose={onClose} wide><form onSubmit={submit}>
    <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass} htmlFor="routine-name">Routine name</label><input id="routine-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="Upper body A" data-testid="input-routine-name"/></div><div><label className={labelClass} htmlFor="routine-group">Program / group</label><input id="routine-group" className={fieldClass} value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Strength block" data-testid="input-routine-group"/></div></div>
    <div className="mt-5"><label className={labelClass} htmlFor="exercise-search">Add exercises</label><input id="exercise-search" className={fieldClass} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search exercise library" data-testid="input-exercise-search"/><div className="mt-2 grid max-h-36 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">{matches.map((ex) => <button type="button" key={ex.id} disabled={exerciseIds.includes(ex.id)} onClick={() => addExercise(ex.id)} className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[hsl(var(--muted))] disabled:opacity-40" data-testid={`button-add-exercise-${ex.id}`}><span>{ex.name}<span className="ml-1 text-[10px] text-[hsl(var(--muted-foreground))]">{ex.equipment}</span></span><Plus size={13}/></button>)}</div>
      <CustomExerciseMuscles onCreated={(created) => { addExercise(created.id); setCounts((c) => ({ ...c, [created.id]: 3 })); }}/>
    </div>
    <div className="mt-5"><div className="mb-1.5 flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-semibold tracking-wide text-[hsl(var(--muted-foreground))]">Routine exercises · sets, rep targets and rest</p><label className="mono flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">DEFAULT REPS<input aria-label="Default reps" className={`${fieldClass} w-16 px-1.5 py-1.5 text-center`} type="number" min="1" max="100" value={defaultReps} onChange={(e) => setDefaultReps(e.target.value)} data-testid="input-routine-default-reps"/></label></div>
      {selected.length ? <div className="space-y-2">{selected.map((ex, index) => <div key={ex.id} className="rounded-xl bg-[hsl(var(--background))] p-2.5" data-testid={`row-routine-exercise-${ex.id}`}>
        <div className="flex flex-wrap items-center gap-2"><span className="mono w-6 text-[10px] text-[hsl(var(--muted-foreground))]">{String(index + 1).padStart(2, "0")}</span><span className="min-w-[120px] flex-1 truncate text-sm font-medium">{ex.name}</span><label className="mono flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">SETS<input aria-label={`${ex.name} set count`} className={`${fieldClass} w-14 px-1.5 py-1.5 text-center`} type="number" min="1" max="20" value={countOf(ex.id)} onChange={(e) => setCount(ex.id, Number(e.target.value))} data-testid={`input-routine-sets-${ex.id}`}/></label><label className="mono flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">REST<input aria-label={`${ex.name} rest seconds`} className={`${fieldClass} w-16 px-1.5 py-1.5 text-center`} type="number" min="0" max="600" step="1" value={restTimes[ex.id] ?? 90} onChange={(e) => setRestTimes((t) => ({ ...t, [ex.id]: Math.min(600, Math.max(0, Number(e.target.value) || 0)) }))} data-testid={`input-routine-rest-${ex.id}`}/><span>s</span></label><button type="button" aria-label={`Remove ${ex.name}`} className="rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-[hsl(0_80%_60%/.12)]" onClick={() => setExerciseIds((ids) => ids.filter((id) => id !== ex.id))} data-testid={`button-remove-exercise-${ex.id}`}><X size={15}/></button></div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-8"><span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">REPS</span>{planOf(ex.id).map((s, i) => <input key={i} aria-label={`${ex.name} set ${i + 1} reps target`} className={`${fieldClass} w-12 px-1 py-1.5 text-center`} type="number" min="1" max="100" placeholder="-" value={s.reps ?? ""} onChange={(e) => setRepsAt(ex.id, i, e.target.value)} data-testid={`input-routine-reps-${ex.id}-${i}`}/>)}<button type="button" className="rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]" onClick={() => applyReps(ex.id)} data-testid={`button-apply-reps-${ex.id}`}>Apply {dReps} to all</button></div>
      </div>)}</div> : <p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">Choose exercises from the library above.</p>}</div>
    {error && <p className="mt-3 text-sm text-[hsl(0_90%_75%)]" role="alert" data-testid="text-routine-error">{error}</p>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-4"><div className="flex flex-wrap gap-2">{onDelete && <button type="button" className={`${quietBtn} text-[hsl(var(--destructive))]`} onClick={onDelete} data-testid="button-delete-routine"><Trash2 size={14}/>Delete routine</button>}<button type="button" className={quietBtn} onClick={asTemplate} data-testid="button-save-template"><BookmarkPlus size={14}/>Save as template</button></div><div className="ml-auto flex gap-2"><button type="button" className={quietBtn} onClick={onClose} data-testid="button-cancel-routine">Cancel</button><button className={primaryBtn} type="submit" data-testid="button-save-routine"><Check size={15}/>Save routine</button></div></div>
  </form></Modal>;
}
