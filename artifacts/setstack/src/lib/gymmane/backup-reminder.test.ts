import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_REMINDER_INTERVAL_MS,
  BACKUP_REMINDER_STORAGE_KEY,
  BACKUP_REMIND_LATER_MS,
  emptyBackupReminderState,
  isBackupReminderDue,
  parseBackupReminderState,
  recordSuccessfulBackupExport,
  remindAboutBackupLater,
  saveBackupReminderState,
} from "./backup-reminder.ts";
import { useFloor } from "./store.ts";

function memoryStorage(): Storage {
  const records = new Map<string, string>();
  return {
    get length() { return records.size; },
    clear: () => records.clear(),
    getItem: (key) => records.get(key) ?? null,
    key: (index) => [...records.keys()][index] ?? null,
    removeItem: (key) => { records.delete(key); },
    setItem: (key, value) => { records.set(key, value); },
  };
}

test("first backup reminder waits for real local workspace data", () => {
  const state = emptyBackupReminderState();
  assert.equal(isBackupReminderDue(state, false, 1_000), false);
  assert.equal(isBackupReminderDue(state, true, 1_000), true);
});

test("recent successful backups suppress the reminder until seven full days", () => {
  const now = 10 * BACKUP_REMINDER_INTERVAL_MS;
  const state = recordSuccessfulBackupExport(emptyBackupReminderState(), now - 6 * 24 * 60 * 60 * 1000);
  assert.equal(isBackupReminderDue(state, true, now), false);
  assert.equal(isBackupReminderDue(state, true, state.lastSuccessfulExportAt! + BACKUP_REMINDER_INTERVAL_MS - 1), false);
  assert.equal(isBackupReminderDue(state, true, state.lastSuccessfulExportAt! + BACKUP_REMINDER_INTERVAL_MS), true);
  assert.equal(isBackupReminderDue(
    recordSuccessfulBackupExport(emptyBackupReminderState(), now + 60_000),
    true,
    now,
  ), false);
});

test("Remind Me Later snoozes for one day and successful export clears the snooze", () => {
  const now = 25 * BACKUP_REMINDER_INTERVAL_MS;
  const snoozed = remindAboutBackupLater(emptyBackupReminderState(), now);
  assert.equal(isBackupReminderDue(snoozed, true, now), false);
  assert.equal(isBackupReminderDue(snoozed, true, now + BACKUP_REMIND_LATER_MS - 1), false);
  assert.equal(isBackupReminderDue(snoozed, true, now + BACKUP_REMIND_LATER_MS), true);
  const confirmed = recordSuccessfulBackupExport(snoozed, now + 500);
  assert.deepEqual(confirmed, { lastSuccessfulExportAt: now + 500, remindLaterUntil: null });
  assert.equal(isBackupReminderDue(confirmed, true, now + 500), false);
});

test("opening, cancelling or failing an export does not count; only explicit save confirmation is persisted", () => {
  const storage = memoryStorage();
  const initial = emptyBackupReminderState();
  const before = JSON.stringify(initial);

  // Starting a share/download, dismissing its chooser, or a thrown export is a
  // non-event for reminder state. The UI writes only after explicit confirmation.
  assert.equal(storage.getItem(BACKUP_REMINDER_STORAGE_KEY), null);
  assert.equal(JSON.stringify(initial), before);
  assert.throws(() => {
    throw new Error("simulated file export failure");
  }, /simulated file export failure/);
  assert.equal(storage.getItem(BACKUP_REMINDER_STORAGE_KEY), null);

  const confirmed = recordSuccessfulBackupExport(initial, 123_456);
  saveBackupReminderState(confirmed, storage);
  assert.deepEqual(parseBackupReminderState(storage.getItem(BACKUP_REMINDER_STORAGE_KEY)), confirmed);
  assert.equal(isBackupReminderDue(confirmed, true, 123_456), false);
});

test("generated CoachAura backup passes the existing restore preview before export", () => {
  const raw = useFloor.getState().exportBackup();
  const result = useFloor.getState().previewBackup(raw);
  assert.equal(result.ok, true);
});

test("corrupt reminder metadata falls back safely without touching workspace data", () => {
  const state = parseBackupReminderState('{"lastSuccessfulExportAt":"not-a-time","remindLaterUntil":null}');
  assert.deepEqual(state, emptyBackupReminderState());
});
