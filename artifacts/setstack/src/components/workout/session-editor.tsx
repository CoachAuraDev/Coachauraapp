import { useState } from "react";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { useFloor } from "@/lib/gymmane/store";
import { KIND_LABEL, SET_KINDS, fromDisplay, toDisplay, uid, type SetKind } from "@/lib/gymmane/engine";
import type { Client, ExerciseLog, SessionLog, SetLog } from "@/lib/gymmane/models";
import { Modal, fieldClass, labelClass, primaryBtn, quietBtn, rirText } from "./shared";

type Row = { key: string; orig?: SetLog; weight: string; reps: string; rir: string; kind: SetKind; init: string };
const wText = (kg: number, unit: "kg" | "lb") => String(Number(toDisplay(kg, unit).toFixed(2)));
const sig = (r: { weight: string; reps: string; rir: string; kind: SetKind }) => `${r.weight}|${r.reps}|${r.rir}|${r.kind}`;

export function SessionEditor({ client, session, onClose }: { client: Client; session: SessionLog; onClose: () => void }) {
  const unit = useFloor((s) => s.unit);
  const updateSession = useFloor((s) => s.updateSession);
  const setNotice = useFloor((s) => s.setNotice);
  const [name, setName] = useState(session.name);
  const [date, setDate] = useState(session.date);
  const [expandedExerciseId, setExpandedExerciseId] = useState<string | null>(session.exercises[0]?.id ?? null);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<Record<string, Row[]>>(() => Object.fromEntries(session.exercises.map((ex) => [ex.id, ex.sets.map((s) => {
    const r = { weight: wText(s.weight, unit), reps: String(s.reps), rir: rirText(s.rpe), kind: s.kind };
    return { key: s.id, orig: s, ...r, init: sig(r) };
  })])));
  const patch = (exId: string, key: string, p: Partial<Row>) => setRows((all) => ({ ...all, [exId]: all[exId].map((r) => (r.key === key ? { ...r, ...p } : r)) }));
  const remove = (exId: string, key: string) => setRows((all) => ({ ...all, [exId]: all[exId].filter((r) => r.key !== key) }));
  const add = (exId: string) => setRows((all) => {
    const list = all[exId]; const last = list[list.length - 1];
    return { ...all, [exId]: [...list, { key: uid(), weight: last?.weight ?? "0", reps: last?.reps ?? "8", rir: "", kind: "normal", init: "" }] };
  });
  const save = () => {
    if (!name.trim()) { setError("Name this workout."); return; }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(`${date}T12:00:00`).getTime())) { setError("Enter a valid date."); return; }
    const exercises: ExerciseLog[] = [];
    for (const ex of session.exercises) {
      const sets: SetLog[] = [];
      for (const [i, r] of (rows[ex.id] ?? []).entries()) {
        if (r.orig && sig(r) === r.init) { sets.push(r.orig); continue; }
        const w = Number(r.weight === "" ? 0 : r.weight), reps = Number(r.reps), rir = r.rir === "" ? null : Number(r.rir);
        if (!Number.isFinite(w) || w < 0 || !Number.isInteger(reps) || reps < 1 || reps > 100 || (rir != null && (!Number.isFinite(rir) || rir < 0 || rir > 10))) { setError(`${ex.name}, set ${i + 1}: check load, whole reps and RIR (0 to 10).`); return; }
        sets.push({ id: r.orig?.id ?? uid(),
          weight: r.orig && r.weight === wText(r.orig.weight, unit) ? r.orig.weight : fromDisplay(w, unit),
          reps, rpe: r.orig && r.rir === rirText(r.orig.rpe) ? r.orig.rpe : rir == null ? null : 10 - rir, kind: r.kind });
      }
      if (sets.length) exercises.push({ ...ex, sets });
    }
    if (!exercises.length) { setError("A workout needs at least one set. Use Cancel and delete the session instead."); return; }
    const ok = updateSession(client.id, { ...session, name: name.trim(), date, exercises });
    if (!ok) { setError("Could not save this workout."); return; }
    setNotice("Workout updated.");
    onClose();
  };
  return <Modal title="Edit workout" onClose={onClose} wide>
    <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass} htmlFor="edit-session-name">Workout name</label><input id="edit-session-name" className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} data-testid="input-edit-session-name"/></div><div><label className={labelClass} htmlFor="edit-session-date">Date</label><input id="edit-session-date" type="date" className={fieldClass} value={date} onChange={(e) => setDate(e.target.value)} data-testid="input-edit-session-date"/></div></div>
    <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Loads in {unit}. Nothing changes until you save.</p>
    <div className="mt-4 space-y-2">{session.exercises.map((ex) => {
      const exerciseRows = rows[ex.id] ?? [];
      const expanded = expandedExerciseId === ex.id;
      return <section key={ex.id} className="overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]" data-testid={`editor-exercise-${ex.id}`}>
        <button type="button" aria-expanded={expanded} aria-controls={`editor-sets-${ex.id}`} onClick={() => setExpandedExerciseId(expanded ? null : ex.id)} className="flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left">
          <span className="min-w-0 flex-1 truncate text-sm font-semibold">{ex.name}</span>
          <span className="mono shrink-0 text-[10px] text-[hsl(var(--muted-foreground))]">{exerciseRows.length} sets</span>
          <ChevronDown size={16} className={`shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}/>
        </button>
        {expanded && <div id={`editor-sets-${ex.id}`} className="space-y-1.5 border-t border-[hsl(var(--border))] p-2.5">
          {exerciseRows.map((r, i) => <div key={r.key} className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-2.5" data-testid={`editor-set-${r.key}`}>
            <div className="mb-2 flex items-center justify-between"><span className="mono text-[11px] font-semibold text-[hsl(var(--muted-foreground))]">SET {i + 1}</span><button type="button" aria-label={`Remove ${ex.name} set ${i + 1}`} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-[hsl(var(--destructive))]" onClick={() => remove(ex.id, r.key)} data-testid={`button-editor-remove-set-${r.key}`}><X size={14}/>Remove</button></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div><label className={labelClass} htmlFor={`ew-${r.key}`}>Load ({unit})</label><input id={`ew-${r.key}`} className={`${fieldClass} min-h-11`} type="number" min="0" step="any" inputMode="decimal" value={r.weight} onChange={(e) => patch(ex.id, r.key, { weight: e.target.value })} data-testid={`input-editor-weight-${r.key}`}/></div>
              <div><label className={labelClass} htmlFor={`er-${r.key}`}>Reps</label><input id={`er-${r.key}`} className={`${fieldClass} min-h-11`} type="number" min="1" inputMode="numeric" value={r.reps} onChange={(e) => patch(ex.id, r.key, { reps: e.target.value })} data-testid={`input-editor-reps-${r.key}`}/></div>
              <div><label className={labelClass} htmlFor={`ei-${r.key}`}>RIR</label><input id={`ei-${r.key}`} className={`${fieldClass} min-h-11`} type="number" min="0" max="10" step="any" inputMode="decimal" placeholder="Optional" value={r.rir} onChange={(e) => patch(ex.id, r.key, { rir: e.target.value })} data-testid={`input-editor-rir-${r.key}`}/></div>
              <div><label className={labelClass} htmlFor={`ek-${r.key}`}>Type</label><select id={`ek-${r.key}`} className={`${fieldClass} min-h-11`} value={r.kind} onChange={(e) => patch(ex.id, r.key, { kind: e.target.value as SetKind })} data-testid={`select-editor-kind-${r.key}`}>{SET_KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></div>
            </div>
          </div>)}
          <button type="button" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[hsl(var(--primary))]" onClick={() => add(ex.id)} data-testid={`button-editor-add-set-${ex.id}`}><Plus size={13}/>Add set</button>
        </div>}
      </section>;
    })}</div>
    {error && <p role="alert" className="mt-4 text-sm text-[hsl(0_90%_75%)]" data-testid="text-editor-error">{error}</p>}
    <div className="mt-5 flex justify-end gap-2 border-t border-[hsl(var(--border))] pt-4"><button type="button" className={quietBtn} onClick={onClose} data-testid="button-editor-cancel">Cancel</button><button type="button" className={primaryBtn} onClick={save} data-testid="button-editor-save"><Check size={15}/>Save changes</button></div>
  </Modal>;
}
