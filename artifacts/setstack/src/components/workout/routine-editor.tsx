import { useState, type FormEvent } from "react";
import { BookmarkPlus, Check, ChevronDown, MoveDown, MoveUp, Plus, Trash2, X } from "lucide-react";
import { useFloor } from "@/lib/gymmane/store";
import { uid } from "@/lib/gymmane/engine";
import type { Client, PlannedSet, Routine } from "@/lib/gymmane/models";
import type { CatalogExercise } from "@/lib/gymmane/catalog";
import { CustomExerciseMuscles } from "@/components/custom-exercise-muscles";
import { ExerciseMuscleIllustration } from "@/components/muscle-map";
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
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(null);
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
    setExpandedExerciseId(id);
  };
  const moveExercise = (index: number, offset: -1 | 1) => setExerciseIds((ids) => {
    const target = index + offset;
    if (target < 0 || target >= ids.length) return ids;
    const next = [...ids];
    [next[index], next[target]] = [next[target]!, next[index]!];
    return next;
  });
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
    <div className="grid gap-3 sm:grid-cols-2">
      <div><label className={labelClass} htmlFor="routine-name">Routine name</label><input id="routine-name" className={`${fieldClass} min-h-11`} value={name} onChange={(e) => setName(e.target.value)} placeholder="Upper body A" data-testid="input-routine-name"/></div>
      <div><label className={labelClass} htmlFor="routine-group">Program / group</label><input id="routine-group" className={`${fieldClass} min-h-11`} value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Strength block" data-testid="input-routine-group"/></div>
    </div>

    <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
      <label className={labelClass} htmlFor="exercise-search">Find and add exercises</label>
      <input id="exercise-search" className={`${fieldClass} min-h-11`} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search by exercise or muscle group" data-testid="input-exercise-search"/>
      <div className="mt-2 max-h-40 overflow-y-auto" role="list" aria-label="Exercise search results">
        {matches.map((ex) => <button type="button" key={ex.id} disabled={exerciseIds.includes(ex.id)} onClick={() => addExercise(ex.id)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-[hsl(var(--muted))] disabled:opacity-40" data-testid={`button-add-exercise-${ex.id}`}>
          <ExerciseMuscleIllustration exercise={ex}/>
          <span className="min-w-0 flex-1 font-medium">{ex.name}<span className="mt-1 block text-xs font-normal text-[hsl(var(--muted-foreground))]">{ex.equipment}</span></span>
          <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-[hsl(var(--primary))]">{exerciseIds.includes(ex.id) ? "Added" : <><Plus size={14}/>Add</>}</span>
        </button>)}
        {!matches.length && <p className="px-3 py-4 text-sm text-[hsl(var(--muted-foreground))]">No exercises match that search.</p>}
      </div>
      <div className="mt-3 border-t border-[hsl(var(--border))] pt-3">
        <CustomExerciseMuscles onCreated={(created) => { addExercise(created.id); setCounts((c) => ({ ...c, [created.id]: 3 })); }}/>
      </div>
    </div>

    <div className="mt-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm font-semibold">Routine exercises</p><p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">Adjust set targets and rest only when needed.</p></div>
        <label className="mono flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">DEFAULT REPS<input aria-label="Default reps" className={`${fieldClass} min-h-11 w-16 px-1.5 py-1.5 text-center`} type="number" inputMode="numeric" min="1" max="100" value={defaultReps} onChange={(e) => setDefaultReps(e.target.value)} data-testid="input-routine-default-reps"/></label>
      </div>
      {selected.length ? <div className="space-y-2">{selected.map((ex, index) => {
        const expanded = expandedExerciseId === ex.id;
        return <div key={ex.id} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2.5" data-testid={`row-routine-exercise-${ex.id}`}>
          <div className="flex min-w-0 items-center gap-2">
            <ExerciseMuscleIllustration exercise={ex}/>
            <div className="min-w-0 flex-1">
              <span className="block break-words text-sm font-medium">{ex.name}</span>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{String(index + 1).padStart(2, "0")}</span>
                <label className="mono flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">SETS<input aria-label={`${ex.name} set count`} className={`${fieldClass} min-h-11 w-14 px-1.5 py-1.5 text-center`} type="number" inputMode="numeric" min="1" max="20" value={countOf(ex.id)} onChange={(e) => setCount(ex.id, Number(e.target.value))} data-testid={`input-routine-sets-${ex.id}`}/></label>
              </div>
            </div>
            <button type="button" aria-label={`${expanded ? "Hide" : "Edit"} ${ex.name} targets`} aria-expanded={expanded} aria-controls={`routine-targets-${ex.id}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))]" onClick={() => setExpandedExerciseId(expanded ? null : ex.id)} data-testid={`button-toggle-targets-${ex.id}`}><ChevronDown size={17} className={`transition-transform ${expanded ? "rotate-180" : ""}`}/></button>
          </div>
          {expanded && <div id={`routine-targets-${ex.id}`} className="mt-2 space-y-3 border-t border-[hsl(var(--border))] pt-3">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <label className="mono flex items-center gap-2 text-[10px] text-[hsl(var(--muted-foreground))]">REST TIME
                <input aria-label={`${ex.name} rest seconds`} className={`${fieldClass} min-h-11 w-20 px-2 text-center`} type="number" inputMode="numeric" min="0" max="600" step="1" value={restTimes[ex.id] ?? 90} onChange={(e) => setRestTimes((t) => ({ ...t, [ex.id]: Math.min(600, Math.max(0, Number(e.target.value) || 0)) }))} data-testid={`input-routine-rest-${ex.id}`}/>
                <span className="text-xs normal-case">seconds</span>
              </label>
              <div className="flex gap-1">
                <button type="button" disabled={index === 0} aria-label={`Move ${ex.name} up`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] disabled:opacity-35" onClick={() => moveExercise(index, -1)} data-testid={`button-move-exercise-up-${ex.id}`}><MoveUp size={16}/></button>
                <button type="button" disabled={index === selected.length - 1} aria-label={`Move ${ex.name} down`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] disabled:opacity-35" onClick={() => moveExercise(index, 1)} data-testid={`button-move-exercise-down-${ex.id}`}><MoveDown size={16}/></button>
                <button type="button" aria-label={`Remove ${ex.name}`} className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-[hsl(var(--destructive))] hover:bg-[hsl(0_80%_60%/.12)]" onClick={() => { setExerciseIds((ids) => ids.filter((id) => id !== ex.id)); setExpandedExerciseId(null); }} data-testid={`button-remove-exercise-${ex.id}`}><X size={16}/></button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono text-[10px] text-[hsl(var(--muted-foreground))]">REP TARGETS</span>
              {planOf(ex.id).map((s, i) => <input key={i} aria-label={`${ex.name} set ${i + 1} reps target`} className={`${fieldClass} min-h-11 w-14 px-1 py-1.5 text-center`} type="number" inputMode="numeric" min="1" max="100" placeholder="—" value={s.reps ?? ""} onChange={(e) => setRepsAt(ex.id, i, e.target.value)} data-testid={`input-routine-reps-${ex.id}-${i}`}/>)}
              <button type="button" className="min-h-11 rounded-lg px-2 text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]" onClick={() => applyReps(ex.id)} data-testid={`button-apply-reps-${ex.id}`}>Apply {dReps} to all</button>
            </div>
          </div>}
        </div>;
      })}</div> : <div className="rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-center" data-testid="empty-routine-exercises"><p className="text-sm font-semibold">Start building your workout</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Add exercises to create this training session.</p><p className="mt-2 text-[11px] text-[hsl(var(--muted-foreground))]">Search above and tap Add beside an exercise.</p></div>}
    </div>
    {error && <p className="mt-3 text-sm text-[hsl(0_90%_75%)]" role="alert" data-testid="text-routine-error">{error}</p>}
    <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-[hsl(var(--border))] pt-4">
      <div className="flex flex-wrap gap-2">{onDelete && <button type="button" className={`${quietBtn} text-[hsl(var(--destructive))]`} onClick={onDelete} data-testid="button-delete-routine"><Trash2 size={14}/>Delete routine</button>}<button type="button" className={quietBtn} onClick={asTemplate} data-testid="button-save-template"><BookmarkPlus size={14}/>Save as template</button></div>
      <div className="ml-auto flex gap-2"><button type="button" className={quietBtn} onClick={onClose} data-testid="button-cancel-routine">Cancel</button><button className={primaryBtn} type="submit" data-testid="button-save-routine"><Check size={15}/>{routine ? "Save changes" : "Save routine"}</button></div>
    </div>
  </form></Modal>;
}
