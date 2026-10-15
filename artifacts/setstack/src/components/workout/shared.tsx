import { useEffect, useRef, type ReactNode } from "react";
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
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => registerNativeBackHandler(onClose), [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    const isTopmost = () => Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"]')).at(-1) === panel.current;
    const first = panel.current?.querySelector<HTMLElement>("[autofocus]") ?? focusable()[0] ?? panel.current;
    first?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (!isTopmost()) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusable();
      const firstElement = elements[0];
      const lastElement = elements.at(-1);
      if (!firstElement) {
        event.preventDefault();
        panel.current?.focus();
      } else if (event.shiftKey && (document.activeElement === firstElement || !panel.current?.contains(document.activeElement))) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && (document.activeElement === lastElement || !panel.current?.contains(document.activeElement))) {
        event.preventDefault();
        firstElement.focus();
      }
    };
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("keydown", keyboard);
      document.body.style.overflow = originalOverflow;
      previousFocus?.focus();
    };
  }, []);
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title" tabIndex={-1} className={`max-h-[92dvh] w-full min-w-0 overflow-y-auto rounded-t-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-2xl [overflow-wrap:anywhere] sm:rounded-3xl ${wide ? "max-w-2xl" : "max-w-lg"}`}>
      <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">CoachAura workspace</p><h2 id="workspace-modal-title" className="display-font mt-1 text-xl font-semibold">{title}</h2></div><button className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))]" onClick={onClose} aria-label="Close dialog" data-testid="button-close-dialog"><X size={18}/></button></div>
      {children}
    </div>
  </div>;
}

export function rirText(rpe: number | null): string {
  return rpe == null ? "" : String(Number((10 - rpe).toFixed(1)));
}
