import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { registerNativeBackHandler } from "@/lib/native/back-handlers";

export const fieldClass = "w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]";
export const btn = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-px disabled:pointer-events-none disabled:opacity-45";
export const primaryBtn = `${btn} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]`;
export const quietBtn = `${btn} border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]`;
export const labelClass = "mb-1.5 block text-xs font-semibold tracking-wide text-[hsl(var(--muted-foreground))]";

export type ConfirmRequest = { title: string; message: string; confirmLabel: string; onConfirm: () => void };
export type AskConfirm = (o: ConfirmRequest) => void;

export function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => registerNativeBackHandler(onClose), [onClose]);
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92dvh] w-full min-w-0 overflow-y-auto rounded-t-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-2xl [overflow-wrap:anywhere] sm:rounded-3xl ${wide ? "max-w-2xl" : "max-w-lg"}`}>
      <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">CoachAura workspace</p><h2 className="display-font mt-1 text-xl font-semibold">{title}</h2></div><button className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" onClick={onClose} aria-label="Close dialog" data-testid="button-close-dialog"><X size={18}/></button></div>
      {children}
    </div>
  </div>;
}

export function rirText(rpe: number | null): string {
  return rpe == null ? "" : String(Number((10 - rpe).toFixed(1)));
}
