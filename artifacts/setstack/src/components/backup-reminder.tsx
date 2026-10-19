import { useCallback, useState } from "react";
import { ArrowDownToLine, ShieldCheck } from "lucide-react";
import { useFloor } from "@/lib/gymmane/store";
import {
  BACKUP_REMINDER_STORAGE_KEY,
  emptyBackupReminderState,
  isBackupReminderDue,
  parseBackupReminderState,
  recordSuccessfulBackupExport,
  remindAboutBackupLater,
  saveBackupReminderState,
} from "@/lib/gymmane/backup-reminder";
import { todayIso } from "@/lib/gymmane/engine";
import { exportBackupFile } from "@/lib/native/backup";
import { isAndroidApp } from "@/lib/native/android";
import { primaryBtn, quietBtn } from "@/components/workout/shared";

function readReminderState() {
  if (typeof window === "undefined") return emptyBackupReminderState();
  try {
    return parseBackupReminderState(window.localStorage.getItem(BACKUP_REMINDER_STORAGE_KEY));
  } catch {
    return emptyBackupReminderState();
  }
}

export function useBackupReminder() {
  const [state, setState] = useState(readReminderState);
  const persist = useCallback((next: ReturnType<typeof emptyBackupReminderState>) => {
    try {
      if (typeof window === "undefined") return false;
      saveBackupReminderState(next, window.localStorage);
      setState(next);
      return true;
    } catch {
      return false;
    }
  }, []);
  const recordSuccessfulExport = useCallback((at = Date.now()) => {
    try {
      return persist(recordSuccessfulBackupExport(state, at));
    } catch {
      return false;
    }
  }, [persist, state]);
  const remindLater = useCallback((now = Date.now()) => {
    try {
      return persist(remindAboutBackupLater(state, now));
    } catch {
      return false;
    }
  }, [persist, state]);

  return { state, recordSuccessfulExport, remindLater };
}

export function BackupExportAction({
  buttonLabel,
  buttonClassName = primaryBtn,
  testId = "button-export-backup",
  onConfirmSaved,
}: {
  buttonLabel: string;
  buttonClassName?: string;
  testId?: string;
  onConfirmSaved: (at: number) => boolean;
}) {
  const [exporting, setExporting] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [exportMode, setExportMode] = useState<"android" | "browser">("browser");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const startExport = async () => {
    if (exporting) return;
    setError("");
    setMessage("");
    setExporting(true);
    try {
      const floor = useFloor.getState();
      const content = floor.exportBackup();
      const preview = floor.previewBackup(content);
      if (!preview.ok) throw new Error(`The generated backup did not pass validation: ${preview.error}`);
      const mode = await exportBackupFile(content, `coachaura-backup-${todayIso()}.json`);
      setExportMode(mode);
      setAwaitingConfirmation(true);
    } catch (cause) {
      setError(`Could not export the backup: ${cause instanceof Error ? cause.message : String(cause)}`);
    } finally {
      setExporting(false);
    }
  };

  const confirmSaved = () => {
    if (!onConfirmSaved(Date.now())) {
      setError("The file may have been saved, but CoachAura could not record the backup time on this device. Check device storage and try confirming again.");
      return;
    }
    setAwaitingConfirmation(false);
    setError("");
    setMessage("Backup recorded on this device. Keep the file in a private, permanent location.");
  };

  return <div className="mt-3">
    <button type="button" className={buttonClassName} onClick={() => void startExport()} disabled={exporting} data-testid={testId}>
      <ArrowDownToLine size={15}/>{exporting ? "Preparing backup…" : buttonLabel}
    </button>
    {awaitingConfirmation && <div className="mt-3 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3" role="group" aria-label="Confirm backup was saved" data-testid="backup-export-confirmation">
      <p className="text-sm font-semibold">Did you save a permanent copy?</p>
      <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
        {exportMode === "android"
          ? "The share sheet has closed. The temporary CoachAura file is not a permanent backup unless you saved it to a destination."
          : "The download was started. Confirm only after the JSON file appears in your chosen download location."}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={primaryBtn} onClick={confirmSaved} data-testid="button-confirm-backup-saved">I saved a copy</button>
        <button type="button" className={quietBtn} onClick={() => { setAwaitingConfirmation(false); setMessage("No backup was recorded. You can export one from Settings at any time."); }} data-testid="button-backup-not-saved">Not saved</button>
      </div>
    </div>}
    {error && <p role="alert" className="mt-3 rounded-xl bg-[hsl(var(--destructive))]/10 px-3 py-2 text-sm text-[hsl(var(--destructive))]" data-testid="backup-export-error">{error}</p>}
    {message && <p role="status" className="mt-3 rounded-xl bg-[hsl(var(--accent))] px-3 py-2 text-sm" data-testid="backup-export-status">{message}</p>}
  </div>;
}

export function BackupReminderCard({
  hasLocalData,
  onConfirmSaved,
  onRemindLater,
  dataLabel = "client data",
}: {
  hasLocalData: boolean;
  onConfirmSaved: (at: number) => boolean;
  onRemindLater: () => boolean;
  dataLabel?: "client data" | "training data";
}) {
  const [dismissError, setDismissError] = useState("");
  if (!isBackupReminderDue(readReminderState(), hasLocalData)) return null;
  return <section className="mb-4 rounded-2xl border border-[hsl(var(--primary))]/35 bg-[hsl(var(--card))] p-4 sm:p-5" aria-labelledby="backup-reminder-title" data-testid="backup-reminder">
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"><ShieldCheck size={19}/></span>
      <div className="min-w-0 flex-1">
        <h2 id="backup-reminder-title" className="display-font text-lg font-semibold">Protect your {dataLabel}</h2>
        <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Your CoachAura data is stored on this device. Create a backup regularly to protect against data loss if your phone is lost, damaged or replaced.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BackupExportAction buttonLabel="Back Up Now" testId="button-backup-now" onConfirmSaved={onConfirmSaved}/>
          <button type="button" className={quietBtn} onClick={() => { setDismissError(onRemindLater() ? "" : "Could not save this reminder preference. Please try again."); }} data-testid="button-backup-remind-later">Remind Me Later</button>
        </div>
        {dismissError && <p role="alert" className="mt-2 text-xs text-[hsl(var(--destructive))]">{dismissError}</p>}
      </div>
    </div>
  </section>;
}

export function BackupStatusText({ timestamp }: { timestamp: number | null }) {
  return <p className="text-sm" data-testid="last-successful-backup">
    {timestamp === null
      ? "No successful export has been confirmed on this device yet."
      : `Last successful export: ${new Date(timestamp).toLocaleString()}`}
  </p>;
}
