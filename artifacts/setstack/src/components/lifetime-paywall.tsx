import { useEffect, useSyncExternalStore } from "react";
import { Check, Crown, LoaderCircle, RotateCcw, ShieldCheck, X } from "lucide-react";
import { billingController } from "@/lib/billing/controller";
import { FREE_CLIENT_LIMIT } from "@/lib/billing/entitlement";
import { Modal, primaryBtn, quietBtn } from "@/components/workout/shared";

export function useBillingSnapshot() {
  return useSyncExternalStore(
    billingController.subscribe,
    billingController.getSnapshot,
    billingController.getSnapshot,
  );
}

export function LifetimePaywall({ onClose }: { onClose: () => void }) {
  const billing = useBillingSnapshot();

  useEffect(() => {
    void billingController.refresh();
  }, []);

  const isLifetime = billing.status === "lifetime";
  const statusTone = billing.status === "error" || billing.status === "unavailable"
    ? "border-[hsl(var(--destructive))]/30 bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]"
    : billing.status === "pending"
      ? "border-amber-500/30 bg-amber-500/10 text-amber-200"
      : "border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--muted-foreground))]";

  return <Modal title="CoachAura Lifetime" onClose={onClose}>
    <div className="mb-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]">
          <Crown size={20}/>
        </div>
        <div>
          <p className="text-sm font-semibold">Keep your whole coaching roster together</p>
          <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
            Free includes up to {FREE_CLIENT_LIMIT} clients. Lifetime unlock removes that limit with one payment—no subscription or recurring charge.
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 border-t border-[hsl(var(--border))] pt-4 text-xs">
        {["Unlimited client profiles", "All client workout history stays on this device", "One-time purchase; no subscription"].map((item) =>
          <li key={item} className="flex items-center gap-2"><Check size={14} className="text-[hsl(var(--primary))]"/>{item}</li>,
        )}
      </ul>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[hsl(var(--card))] px-3 py-3">
        <span className="text-xs text-[hsl(var(--muted-foreground))]">Lifetime · one time</span>
        <strong className="text-sm">{billing.price ?? "Price shown by Google Play"}</strong>
      </div>
    </div>

    {billing.message && <p role="status" className={`mb-4 rounded-xl border px-3 py-2.5 text-xs leading-relaxed ${statusTone}`} data-testid="billing-message">
      {billing.status === "lifetime" && <ShieldCheck size={14} className="mr-1 inline"/>}
      {billing.message}
    </p>}

    {billing.debugBuild && <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
      <p className="text-xs font-semibold text-amber-200">Development test controls</p>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Temporary local simulation only. It is not saved and is disabled in release builds.</p>
      <button type="button" className={`${quietBtn} mt-3 w-full`} onClick={() => billingController.setDebugSimulation(!isLifetime || billing.source !== "debug")} data-testid="button-debug-lifetime">
        {isLifetime && billing.source === "debug" ? "Clear test unlock" : "Simulate lifetime unlock"}
      </button>
    </div>}

    <div className="grid gap-2">
      <button
        type="button"
        className={`${primaryBtn} w-full`}
        onClick={() => void billingController.purchase()}
        disabled={billing.busy || !billing.price || !["free", "error"].includes(billing.status)}
        data-testid="button-buy-lifetime"
      >
        {billing.busy ? <LoaderCircle size={16} className="animate-spin"/> : <Crown size={16}/>}
        {isLifetime ? "Lifetime access active" : billing.busy ? "Contacting Google Play…" : "Unlock unlimited clients"}
      </button>
      <button type="button" className={`${quietBtn} w-full`} onClick={() => void billingController.refresh()} disabled={billing.busy} data-testid="button-restore-purchases">
        {billing.busy ? <LoaderCircle size={15} className="animate-spin"/> : <RotateCcw size={15}/>}
        Restore / recheck purchase
      </button>
      <button type="button" className={`${quietBtn} w-full`} onClick={onClose} data-testid="button-close-paywall"><X size={15}/>Close</button>
    </div>
    <p className="mt-4 text-center text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">
      Google Play confirms purchases on this device. Client data remains local and is never removed when access is limited.
    </p>
  </Modal>;
}
