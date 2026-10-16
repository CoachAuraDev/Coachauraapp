export const BACKUP_REMINDER_STORAGE_KEY = "coachaura-backup-reminder-v1";
export const BACKUP_REMINDER_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const BACKUP_REMIND_LATER_MS = 24 * 60 * 60 * 1000;

export type BackupReminderState = {
  lastSuccessfulExportAt: number | null;
  remindLaterUntil: number | null;
};

export const emptyBackupReminderState = (): BackupReminderState => ({
  lastSuccessfulExportAt: null,
  remindLaterUntil: null,
});

export function parseBackupReminderState(raw: string | null): BackupReminderState {
  if (raw === null) return emptyBackupReminderState();
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return emptyBackupReminderState();
    const state = value as Record<string, unknown>;
    const validTime = (time: unknown) => time === null || (typeof time === "number" && Number.isFinite(time) && time >= 0);
    if (!validTime(state.lastSuccessfulExportAt) || !validTime(state.remindLaterUntil)) return emptyBackupReminderState();
    return {
      lastSuccessfulExportAt: state.lastSuccessfulExportAt as number | null,
      remindLaterUntil: state.remindLaterUntil as number | null,
    };
  } catch {
    return emptyBackupReminderState();
  }
}

export function isBackupReminderDue(
  state: BackupReminderState,
  hasLocalData: boolean,
  now = Date.now(),
): boolean {
  if (!hasLocalData) return false;
  if (state.remindLaterUntil !== null && now < state.remindLaterUntil) return false;
  if (state.lastSuccessfulExportAt === null) return true;
  return state.lastSuccessfulExportAt <= now && now - state.lastSuccessfulExportAt >= BACKUP_REMINDER_INTERVAL_MS;
}

export function recordSuccessfulBackupExport(
  state: BackupReminderState,
  at = Date.now(),
): BackupReminderState {
  if (!Number.isFinite(at) || at < 0) throw new Error("Backup export time must be a valid timestamp.");
  return { lastSuccessfulExportAt: at, remindLaterUntil: null };
}

export function remindAboutBackupLater(
  state: BackupReminderState,
  now = Date.now(),
): BackupReminderState {
  if (!Number.isFinite(now) || now < 0) throw new Error("Reminder time must be a valid timestamp.");
  return { ...state, remindLaterUntil: now + BACKUP_REMIND_LATER_MS };
}

export function saveBackupReminderState(
  state: BackupReminderState,
  storage: Pick<Storage, "setItem">,
): void {
  storage.setItem(BACKUP_REMINDER_STORAGE_KEY, JSON.stringify(state));
}
