import { Suspense, lazy, useMemo, useState } from "react";
import { Check, ChevronRight, ClipboardList, Dumbbell, Library, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { ExerciseLibrary } from "@/components/trainer-dashboard";
import { Modal, primaryBtn, quietBtn } from "@/components/workout/shared";
import { useFloor } from "@/lib/gymmane/store";
import { kExercises, type CatalogExercise } from "@/lib/gymmane/catalog";
import { uid } from "@/lib/gymmane/engine";
import { individualWorkoutOwner, type Draft, type IndividualProfile, type Routine } from "@/lib/gymmane/models";

const RoutineModal = lazy(() => import("@/components/workout/routine-editor").then((module) => ({ default: module.RoutineModal })));

type Section = "library" | "plans";
const kicker = "mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]";
const muted = "text-[hsl(var(--muted-foreground))]";
const panel = "rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-4 sm:p-5";
const buttonBase = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45";
const primaryButton = `${buttonBase} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]`;
const quietButton = `${buttonBase} border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]`;

export function IndividualWorkoutPlanner({
  profile,
  draft,
  onStartPlan,
}: {
  profile: IndividualProfile;
  draft: Draft | null;
  onStartPlan: (routineId: string) => void;
}) {
  const [section, setSection] = useState<Section>("library");
  const [selectedExercise, setSelectedExercise] = useState<CatalogExercise | null>(null);
  const [newPlanName, setNewPlanName] = useState("");
  const [addError, setAddError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorPlan, setEditorPlan] = useState<Routine | undefined>();
  const [deletePlan, setDeletePlan] = useState<Routine | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const plans = profile.plans ?? [];
  const custom = useFloor((state) => state.custom);
  const savePlan = useFloor((state) => state.saveIndividualPlan);
  const deletePlanFromStore = useFloor((state) => state.deleteIndividualPlan);
  const setNotice = useFloor((state) => state.setNotice);
  const pool = useMemo(() => [...kExercises, ...custom], [custom]);
  const names = useMemo(() => new Map(pool.map((exercise) => [exercise.id, exercise.name])), [pool]);
  const owner = useMemo(() => individualWorkoutOwner(profile), [profile]);
  const exerciseToAddAlreadyIn = (plan: Routine) => !!selectedExercise && plan.exerciseIds.includes(selectedExercise.id);

  const addToPlan = (plan: Routine) => {
    if (!selectedExercise) return;
    if (plan.exerciseIds.includes(selectedExercise.id)) {
      setAddError(`${selectedExercise.name} is already in ${plan.name}.`);
      return;
    }
    const next: Routine = {
      ...structuredClone(plan),
      exerciseIds: [...plan.exerciseIds, selectedExercise.id],
      sets: { ...plan.sets, [selectedExercise.id]: plan.sets[selectedExercise.id] ?? 3 },
      plan: { ...plan.plan },
      rest: { ...plan.rest, [selectedExercise.id]: profile.restSeconds },
    };
    if (!savePlan(next)) {
      setAddError("The plan could not be saved to this device. Your existing plan is unchanged; check device storage and retry.");
      return;
    }
    setNotice(`${selectedExercise.name} added to ${plan.name}.`);
    setSelectedExercise(null);
    setAddError("");
    setSection("plans");
  };

  const createPlanWithExercise = () => {
    if (!selectedExercise || !newPlanName.trim()) {
      setAddError("Enter a name for this workout plan.");
      return;
    }
    const next: Routine = {
      id: uid(),
      name: newPlanName.trim(),
      group: "Personal",
      exerciseIds: [selectedExercise.id],
      sets: { [selectedExercise.id]: 3 },
      plan: {},
      rest: { [selectedExercise.id]: profile.restSeconds },
    };
    if (!savePlan(next)) {
      setAddError("The plan could not be saved to this device. Nothing was changed; check device storage and retry.");
      return;
    }
    setNotice(`${next.name} created with ${selectedExercise.name}.`);
    setNewPlanName("");
    setSelectedExercise(null);
    setAddError("");
    setSection("plans");
  };

  const openCreate = () => {
    setEditorPlan(undefined);
    setEditorOpen(true);
  };
  const openEdit = (plan: Routine) => {
    setEditorPlan(plan);
    setEditorOpen(true);
  };
  const closeEditor = () => {
    setEditorOpen(false);
    setEditorPlan(undefined);
  };

  return <section className="min-w-0 space-y-4" data-testid="individual-exercises-screen">
    <header>
      <p className={kicker}>Your training</p>
      <h1 className="display-font mt-1 text-3xl font-semibold tracking-tight">Exercises</h1>
      <p className={`mt-2 text-sm ${muted}`}>Browse exercises and build reusable plans for your personal workouts.</p>
    </header>

    <div role="tablist" aria-label="Exercises sections" className="grid grid-cols-2 gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1" data-testid="individual-exercise-sections">
      {([
        { id: "library" as const, label: "Exercise Library", Icon: Library },
        { id: "plans" as const, label: "My Workout Plans", Icon: ClipboardList },
      ]).map(({ id, label, Icon }) => <button key={id} type="button" role="tab" aria-selected={section === id} onClick={() => setSection(id)} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg px-2 text-xs font-semibold sm:text-sm ${section === id ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))] shadow-sm" : muted}`} data-testid={`tab-individual-exercises-${id}`}><Icon size={16} aria-hidden="true"/>{label}{id === "plans" && <span className="mono text-[10px]">{plans.length}</span>}</button>)}
    </div>

    {section === "library" ? <>
      <div className={panel}>
        <div className="mb-2"><h2 className="display-font text-lg font-semibold">Exercise Library</h2><p className={`mt-1 text-xs ${muted}`}>Choose an exercise, then add it to a saved plan or start a new one.</p></div>
        <ExerciseLibrary inline showHeading={false} selectLabel="Add to plan" onSelect={(exercise) => {
          setSelectedExercise(exercise);
          setNewPlanName("");
          setAddError("");
        }}/>
      </div>
    </> : <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className={kicker}>Your training</p><h2 className="display-font mt-1 text-2xl font-semibold">My Workout Plans</h2><p className={`mt-1 text-sm ${muted}`}>Plans are saved separately from completed workouts.</p></div>
        <button type="button" className={primaryButton} onClick={openCreate} data-testid="button-create-individual-plan"><Plus size={16}/>Create Workout Plan</button>
      </div>
      {plans.length ? <div className="space-y-3" data-testid="list-individual-plans">
        {plans.map((plan) => <article key={plan.id} className={panel} data-testid={`card-individual-plan-${plan.id}`}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"><Dumbbell size={18}/></span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1"><h3 className="display-font text-lg font-semibold">{plan.name}</h3><span className={`text-xs ${muted}`}>{plan.exerciseIds.length} {plan.exerciseIds.length === 1 ? "exercise" : "exercises"}</span></div>
              {plan.exerciseIds.length ? <ol className={`mt-2 space-y-1 text-sm ${muted}`} aria-label={`${plan.name} exercises`}>{plan.exerciseIds.map((exerciseId, index) => <li key={exerciseId} className="flex min-w-0 gap-2"><span className="mono w-5 shrink-0 text-[10px]">{String(index + 1).padStart(2, "0")}</span><span className="truncate">{names.get(exerciseId) ?? "Unavailable exercise"}</span><span className="ml-auto shrink-0 text-[10px]">{plan.sets[exerciseId] ?? 3} sets</span></li>)}</ol> : <p className={`mt-2 text-xs ${muted}`}>No exercises added yet.</p>}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
              <button type="button" className={primaryButton} onClick={() => onStartPlan(plan.id)} aria-label={`Start workout from ${plan.name}`} data-testid={`button-start-individual-plan-${plan.id}`}><Play size={15}/>{draft ? "Resume workout" : "Start Workout"}</button>
              <button type="button" className={quietButton} onClick={() => openEdit(plan)} aria-label={`Edit ${plan.name}`} data-testid={`button-edit-individual-plan-${plan.id}`}><Pencil size={15}/><span className="sm:hidden">Edit</span></button>
              <button type="button" className={`${quietButton} text-[hsl(var(--destructive))]`} onClick={() => { setDeletePlan(plan); setDeleteError(""); }} aria-label={`Delete ${plan.name}`} data-testid={`button-delete-individual-plan-${plan.id}`}><Trash2 size={15}/><span className="sm:hidden">Delete</span></button>
            </div>
          </div>
        </article>)}
      </div> : <div className={`${panel} border-dashed text-center`} data-testid="empty-individual-plans">
        <ClipboardList className="mx-auto text-[hsl(var(--primary))]" size={20}/>
        <h3 className="display-font mt-2 text-lg font-semibold">No workout plans yet</h3>
        <p className={`mx-auto mt-1 max-w-sm text-sm ${muted}`}>Build a reusable exercise list, then start a workout without changing the saved plan.</p>
        <button type="button" className={`${primaryButton} mt-4`} onClick={openCreate} data-testid="button-empty-create-individual-plan"><Plus size={16}/>Create Workout Plan</button>
      </div>}
      {draft && <p className={`rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3 text-xs leading-relaxed ${muted}`} role="status" data-testid="text-plan-active-workout">An unfinished workout is already active. Starting a plan will resume it; finish or explicitly discard it before starting another.</p>}
    </>}

    {selectedExercise && <Modal title={`Add ${selectedExercise.name} to a plan`} onClose={() => setSelectedExercise(null)}>
      <p className={`mb-3 text-sm ${muted}`}>Choose a saved plan or create a new one. Existing workout results will not be changed.</p>
      {plans.length ? <div className="max-h-56 space-y-2 overflow-y-auto" aria-label="Available personal plans" data-testid="list-plan-choices">
        {plans.map((plan) => {
          const exists = exerciseToAddAlreadyIn(plan);
          return <button key={plan.id} type="button" disabled={exists} onClick={() => addToPlan(plan)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 text-left text-sm disabled:opacity-60" data-testid={`button-add-exercise-to-plan-${plan.id}`}><span className="min-w-0 truncate font-semibold">{plan.name}</span><span className={`flex shrink-0 items-center gap-1 text-xs ${exists ? muted : "text-[hsl(var(--primary))]"}`}>{exists ? <><Check size={14}/>Already added</> : <>Add<ChevronRight size={14}/></>}</span></button>;
        })}
      </div> : <p className={`rounded-xl border border-dashed border-[hsl(var(--border))] p-3 text-sm ${muted}`}>You do not have a saved plan yet. Create one below with this exercise included.</p>}
      <form className="mt-4 border-t border-[hsl(var(--border))] pt-4" onSubmit={(event) => { event.preventDefault(); createPlanWithExercise(); }}>
        <label htmlFor="new-personal-plan-name" className="mb-1.5 block text-xs font-semibold text-[hsl(var(--muted-foreground))]">Create a new plan</label>
        <div className="flex gap-2"><input id="new-personal-plan-name" autoFocus className="min-h-11 min-w-0 flex-1 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm" placeholder="e.g. Push Day" value={newPlanName} onChange={(event) => setNewPlanName(event.target.value)} data-testid="input-new-plan-name"/><button type="submit" className={primaryButton} data-testid="button-create-plan-with-exercise"><Plus size={15}/>Create</button></div>
      </form>
      {addError && <p role="alert" className="mt-3 text-sm text-[hsl(var(--destructive))]" data-testid="text-plan-add-error">{addError}</p>}
      <div className="mt-4 flex justify-end"><button type="button" className={quietButton} onClick={() => setSelectedExercise(null)}>Cancel</button></div>
    </Modal>}

    {deletePlan && <Modal title={`Delete ${deletePlan.name}?`} onClose={() => setDeletePlan(null)}>
      <p className={`text-sm leading-relaxed ${muted}`}>This removes the saved plan only. Completed workouts and workout history remain unchanged.</p>
      {deleteError && <p role="alert" className="mt-3 text-sm text-[hsl(var(--destructive))]">{deleteError}</p>}
      <div className="mt-5 flex justify-end gap-2"><button type="button" className={quietButton} onClick={() => setDeletePlan(null)}>Keep plan</button><button type="button" className={`${primaryButton} bg-[hsl(var(--destructive))]`} onClick={() => {
        if (!deletePlanFromStore(deletePlan.id)) {
          setDeleteError("The plan was not deleted. Check device storage and try again.");
          return;
        }
        setNotice(`${deletePlan.name} deleted. Workout history is unchanged.`);
        setDeletePlan(null);
      }} data-testid="button-confirm-delete-individual-plan"><Trash2 size={15}/>Delete plan</button></div>
    </Modal>}

    {editorOpen && <Suspense fallback={<Modal title="Opening plan editor…" onClose={closeEditor}><p role="status" className="text-sm">Loading workout plan editor…</p></Modal>}>
      <RoutineModal key={editorPlan?.id ?? "new-personal-workout-plan"} client={owner} routine={editorPlan} pool={pool} personalMode onClose={closeEditor}/>
    </Suspense>}
  </section>;
}
