import { useEffect, useState, useSyncExternalStore } from "react";
import { useFloor } from "@/lib/gymmane/store";
import { attemptedRecoveryState, getPersistenceHealth, PersistenceFailure, subscribePersistence } from "@/lib/gymmane/durable-persistence";
import { encodeBackup, MAX_BACKUP_BYTES, validateSavedFloor } from "@/lib/gymmane/backup";
import { exportBackupFile } from "@/lib/native/backup";
import { todayIso } from "@/lib/gymmane/engine";
import { BackupRestoreDialog, exportOriginalStorage } from "./backup-restore";
import { primaryBtn, quietBtn } from "./workout/shared";

export function usePersistenceHealth() {
  return useSyncExternalStore(subscribePersistence, getPersistenceHealth, getPersistenceHealth);
}
export function PersistenceStatus() {
  const health = usePersistenceHealth();
  const [message, setMessage] = useState("");
  const [raw, setRaw] = useState<string | null>(null);
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      if (event.error instanceof PersistenceFailure || event.error?.name === "PersistenceFailure") {
        event.preventDefault();
        // The app has already shown a recovery screen. Do not let the dev
        // runtime overlay intercept this expected, explicitly handled failure.
        event.stopImmediatePropagation();
      }
    };
    const rejection = (event: PromiseRejectionEvent) => {
      if (event.reason instanceof PersistenceFailure || event.reason?.name === "PersistenceFailure") {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    };
    window.addEventListener("error", handler, true);
    window.addEventListener("unhandledrejection", rejection, true);
    return () => {
      window.removeEventListener("error", handler, true);
      window.removeEventListener("unhandledrejection", rejection, true);
    };
  }, []);
  if (health.phase !== "read-error" && health.phase !== "write-error") return null;
  const recover = async () => {
    try {
      const pending = attemptedRecoveryState();
      if (health.phase === "write-error" && pending) {
        const mode = await exportBackupFile(encodeBackup(validateSavedFloor(pending)), `coachaura-unsaved-recovery-${todayIso()}.json`);
        setMessage(mode === "android" ? "Unsaved change prepared for sharing. Verify the copy was saved outside CoachAura." : "Recovery copy downloaded; includes the latest attempted change.");
      } else setMessage(await exportOriginalStorage());
    } catch (error) { setMessage(error instanceof Error ? error.message : "Recovery export failed."); }
  };
  const retry = async () => {
    try {
      if (health.phase === "read-error") await useFloor.persist.rehydrate();
      else {
        // Test the last committed state, not the failed action. The original
        // form remains mounted; repeat its action after storage is available.
        useFloor.setState({ clients: [...useFloor.getState().clients] });
        useFloor.getState().setNotice("Storage is writable again. Please repeat the action that failed.");
      }
    } catch { /* The persistence controller displays the failure. */ }
  };
  const read = async (file?: File) => {
    if (!file) return;
    if (file.size > MAX_BACKUP_BYTES) { setMessage("Backup exceeds the 20 MB safety limit."); return; }
    try {
      const text = await file.text();
      const result = useFloor.getState().previewBackup(text);
      if (!result.ok) { setMessage(result.error); return; }
      setRaw(text);
    } catch { setMessage("Could not read the backup file."); }
  };
  return <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-[#0B0B0D]/95 p-5">
    <section role="alertdialog" aria-modal="true" aria-labelledby="storage-error-title" className="w-full max-w-lg rounded-2xl border border-[#303036] bg-[#17171B] p-5 text-[#F5F5F7]">
      <h1 id="storage-error-title" className="display-font text-xl font-semibold">{health.phase === "read-error" ? "Saved data needs attention" : "Change not saved"}</h1>
      <p className="mt-3 text-sm leading-relaxed" role="alert">{health.message}</p>
      <p className="mt-3 text-sm text-[#A1A1AA]">Do not uninstall or clear app data. Free device space or allow browser storage, then retry. Existing forms remain open; after a successful storage check, repeat the failed action.</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <button autoFocus className={primaryBtn} onClick={retry} data-testid="button-retry-storage">{health.phase === "read-error" ? "Retry loading" : "Check storage again"}</button>
        <button className={quietBtn} onClick={recover} data-testid="button-export-recovery">Export recovery copy</button>
      </div>
      {health.phase === "read-error" && <label className={`${quietBtn} mt-3 cursor-pointer`}>Choose verified backup
        <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { void read(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-recovery-backup"/>
      </label>}
      {message && <p role="status" className="mt-3 text-sm">{message}</p>}
      {raw !== null && <div className="relative z-[110]"><BackupRestoreDialog raw={raw} onClose={() => setRaw(null)} onRestored={() => { setRaw(null); setMessage(""); }}/></div>}
    </section>
  </div>;
}
