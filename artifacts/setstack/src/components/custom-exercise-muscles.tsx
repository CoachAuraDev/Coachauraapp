import { useState } from "react";
import { useForm } from "react-hook-form";
import { Plus, Check, ChevronDown } from "lucide-react";
import { Form } from "@/components/ui/form";
import { useFloor } from "@/lib/gymmane/store";
import { MUSCLE_GROUPS, mapExerciseMuscles, type MuscleGroup } from "@/lib/gymmane/muscle-activity";
import type { CatalogExercise } from "@/lib/gymmane/catalog";

type Values = { name: string; primary: string; secondary: MuscleGroup[] };
const field = "w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))]";

export function CustomExerciseMuscles({ onCreated }: { onCreated: (exercise: CatalogExercise) => void }) {
  const custom = useFloor((state) => state.custom);
  const addCustom = useFloor((state) => state.addCustom);
  const updateCustomMuscles = useFloor((state) => state.updateCustomMuscles);
  const [editingId, setEditingId] = useState("");
  const [saved, setSaved] = useState("");
  const form = useForm<Values>({ defaultValues: { name: "", primary: "", secondary: [] } });
  const primary = form.watch("primary");
  const secondary = form.watch("secondary");

  function chooseExercise(id: string) {
    setEditingId(id);
    setSaved("");
    const exercise = custom.find((item) => item.id === id);
    const mapping = exercise ? mapExerciseMuscles(exercise) : null;
    form.reset({
      name: exercise?.name ?? "",
      primary: mapping?.primary ?? "",
      secondary: mapping?.secondary ?? [],
    });
  }

  const save = form.handleSubmit((values) => {
    const primaryGroup = MUSCLE_GROUPS.find((item) => item.id === values.primary)?.id;
    if (!primaryGroup) {
      form.setError("primary", { message: "Choose a primary muscle group." });
      return;
    }
    const others = values.secondary.filter((group) => group !== primaryGroup);
    if (editingId) {
      updateCustomMuscles(editingId, primaryGroup, others);
      setSaved("Muscle mapping saved. This also updates this exercise's historical analytics.");
    } else {
      const created = addCustom(values.name.trim(), primaryGroup, others);
      onCreated(created);
      form.reset({ name: "", primary: "", secondary: [] });
      setSaved("Custom exercise created and added to this routine.");
    }
  });

  return <details className="mt-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3" data-testid="section-custom-exercise">
    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between text-sm font-semibold" data-testid="button-expand-custom-exercise">
      <span>Custom exercises & muscle mapping</span><ChevronDown size={16}/>
    </summary>
    <Form {...form}>
      <div className="mt-3 space-y-3">
        <label className="block text-xs font-semibold">Create or edit
          <select className={`${field} mt-1.5`} value={editingId} onChange={(event) => chooseExercise(event.target.value)} data-testid="select-custom-exercise-edit">
            <option value="">Create a new custom exercise</option>
            {custom.map((exercise) => <option key={exercise.id} value={exercise.id}>{exercise.name}</option>)}
          </select>
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-semibold">Exercise name
            <input className={`${field} mt-1.5`} disabled={!!editingId} placeholder="Exercise name" {...form.register("name", { required: "Enter an exercise name.", validate: (value) => !!value.trim() || "Enter an exercise name." })} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void save(); } }} data-testid="input-custom-exercise-name"/>
            {form.formState.errors.name && <span className="mt-1 block text-red-600" role="alert">{form.formState.errors.name.message}</span>}
          </label>
          <label className="block text-xs font-semibold">Primary muscle
            <select className={`${field} mt-1.5`} {...form.register("primary", { required: "Choose a primary muscle." })} data-testid="select-custom-primary-muscle">
              <option value="">Choose a primary muscle…</option>
              {MUSCLE_GROUPS.map((group) => <option key={group.id} value={group.id}>{group.label}</option>)}
            </select>
            {form.formState.errors.primary && <span className="mt-1 block text-red-600" role="alert">{form.formState.errors.primary.message}</span>}
          </label>
        </div>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold">Secondary muscles <span className="font-normal text-[hsl(var(--muted-foreground))]">· optional · half contribution</span></legend>
          <div className="grid max-h-44 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
            {MUSCLE_GROUPS.filter((group) => group.id !== primary).map((group) => <label key={group.id} className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg px-2 text-xs hover:bg-[hsl(var(--muted))]">
              <input type="checkbox" checked={secondary.includes(group.id)} onChange={(event) => {
                form.setValue("secondary", event.target.checked ? [...secondary, group.id] : secondary.filter((id) => id !== group.id), { shouldDirty: true });
              }} data-testid={`checkbox-custom-secondary-${group.id}`}/>{group.label}
            </label>)}
          </div>
        </fieldset>
        <p className="text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Choose actual involvement, not just stabilisation. Editing a custom exercise changes its muscle analytics for previous logs too.</p>
        <button type="button" onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 py-2 text-sm font-semibold text-[hsl(var(--primary-foreground))]" data-testid={editingId ? "button-save-custom-mapping" : "button-create-custom-exercise"}>
          {editingId ? <Check size={16}/> : <Plus size={16}/>} {editingId ? "Save muscle mapping" : "Create & add exercise"}
        </button>
        {saved && <p className="text-xs text-[hsl(var(--foreground))]" role="status" data-testid="status-custom-mapping">{saved}</p>}
      </div>
    </Form>
  </details>;
}
