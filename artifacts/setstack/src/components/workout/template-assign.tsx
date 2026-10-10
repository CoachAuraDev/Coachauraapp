import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useFloor } from "@/lib/gymmane/store";
import { kProgramTemplates } from "@/lib/gymmane/programs";
import { fieldClass, quietBtn, type AskConfirm } from "./shared";

export function TemplateAssign({ clientId, ask }: { clientId: string; ask: AskConfirm }) {
  const templates = useFloor((s) => s.templates) ?? [];
  const assignProgram = useFloor((s) => s.assignProgram);
  const assignTemplate = useFloor((s) => s.assignTemplate);
  const deleteTemplate = useFloor((s) => s.deleteTemplate);
  const [value, setValue] = useState("");
  const saved = value.startsWith("saved:") ? templates.find((t) => t.id === value.slice(6)) : undefined;
  const assign = () => {
    if (saved) assignTemplate(clientId, saved.id);
    else if (value.startsWith("built:")) assignProgram(clientId, value.slice(6));
    setValue("");
  };
  return <div className="flex flex-wrap items-center gap-2">
    <select className={`${fieldClass} max-w-[210px]`} aria-label="Choose a program or saved template" value={value} onChange={(e) => setValue(e.target.value)} data-testid="select-program-template"><option value="">Assign program…</option>
      <optgroup label="Built-in programs">{kProgramTemplates.map((p) => <option key={p.id} value={`built:${p.id}`}>{p.name}</option>)}</optgroup>
      {templates.length > 0 && <optgroup label="Your templates">{templates.map((t) => <option key={t.id} value={`saved:${t.id}`}>{t.name}</option>)}</optgroup>}
    </select>
    <button className={quietBtn} aria-label="Assign selected program" disabled={!value} onClick={assign} data-testid="button-assign-program"><Plus size={15}/><span className="hidden sm:inline">Assign</span></button>
    {saved && <button className={`${quietBtn} text-[hsl(var(--destructive))]`} onClick={() => ask({ title: "Remove template?", message: `Remove the saved template "${saved.name}" from your library? Routines already assigned to athletes are independent copies and will not be deleted.`, confirmLabel: "Remove template", onConfirm: () => { deleteTemplate(saved.id); setValue(""); } })} data-testid="button-delete-template"><Trash2 size={14}/><span className="hidden sm:inline">Remove template</span></button>}
  </div>;
}
