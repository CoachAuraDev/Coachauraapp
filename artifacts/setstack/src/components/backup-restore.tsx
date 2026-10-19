import { useState } from "react";
import { useFloor } from "@/lib/gymmane/store";
import { encodeBackup, validateSavedFloor } from "@/lib/gymmane/backup";
import { exportBackupFile } from "@/lib/native/backup";
import { todayIso } from "@/lib/gymmane/engine";
import { Modal, primaryBtn, quietBtn } from "./workout/shared";

export async function exportOriginalStorage(checkpoint = false): Promise<string> {
  const key = useFloor.persist.getOptions().name + (checkpoint ? ".before-restore" : "");
  const raw = window.localStorage.getItem(key);
  if (raw === null) throw new Error(checkpoint ? "No pre-restore copy is available." : "No stored file is available to export.");
  let content = raw;
  let label = "original-recovery";
  try {
    const envelope = JSON.parse(raw);
    if ((envelope.version ?? 0) !== 0) throw new Error("Unknown stored envelope version.");
    content = encodeBackup(validateSavedFloor(envelope.state));
    label = checkpoint ? "before-restore" : "saved";
  } catch {
    // Keep the exact unreadable bytes for recovery; never pretend they are a
    // validated portable backup.
  }
  const mode = await exportBackupFile(content, `coachaura-${label}-${todayIso()}.json`);
  return mode === "android" ? "Copy prepared for sharing. Choose a permanent destination and verify it was saved." : "Copy downloaded. Keep it private.";
}

export function BackupRestoreDialog({ raw, onClose, onRestored }: {
  raw: string; onClose: () => void; onRestored: () => void;
}) {
  const floor = useFloor();
  const result = floor.previewBackup(raw);
  const [error, setError] = useState("");
  const currentSessions = floor.clients.reduce((n, c) => n + c.sessions.length, 0);
  const currentIndividualSessions = floor.individualProfile.sessions.length;
  const restore = () => {
    const failure = useFloor.getState().importBackup(raw);
    if (failure) { setError(failure); return; }
    onRestored();
  };
  return <Modal title="Review backup before restoring" onClose={onClose}>
    {!result.ok ? <p role="alert">{result.error}</p> : <>
      <dl className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-[hsl(var(--background))] p-4 text-sm" data-testid="backup-preview">
        <dt>Clients</dt><dd>{result.preview.clients}</dd>
        <dt>Completed workouts</dt><dd>{result.preview.sessions}</dd>
        <dt>Personal workouts</dt><dd>{result.preview.data.individualProfile?.sessions.length ?? 0}</dd>
        <dt>Custom exercises</dt><dd>{result.preview.custom}</dd>
        <dt>Reusable templates</dt><dd>{result.preview.templates}</dd>
        <dt>Unfinished workout</dt><dd>{result.preview.hasDraft ? "Included" : "None"}</dd>
        <dt>Display unit</dt><dd>{result.preview.data.unit}</dd>
      </dl>
      <p className="rounded-xl border border-[hsl(var(--border))] p-4 text-sm leading-relaxed">
        This replaces {floor.clients.length} current clients and {currentSessions} trainer workouts,
        their routines, assignments and measurements, plus the current unfinished workout.
        {result.preview.preservesCurrentIndividualData
          ? ` The v${result.preview.legacy ? "1" : "2"} backup does not contain personal-workout fields, so your ${currentIndividualSessions} personal workout${currentIndividualSessions === 1 ? "" : "s"} and current training mode are preserved.`
          : ` It also replaces personal workout history (${currentIndividualSessions} current; ${result.preview.data.individualProfile?.sessions.length ?? 0} in backup), training mode and theme preference.`}
        {result.preview.legacy
          ? " This older format contains no unfinished workout; the current draft will be cleared. Units stay unchanged. Custom exercises/templates stay unchanged only if absent from the file."
          : " Custom exercises, reusable templates and display units are also replaced."}
        {" "}A pre-restore copy is kept on this device before replacement. If that copy or the new data cannot be written, restoration stops.
      </p>
      <p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Export a permanent backup too: a device-local recovery copy cannot protect against device loss or uninstalling.</p>
    </>}
    {error && <p role="alert" className="mt-3 text-sm text-[hsl(var(--destructive))]">{error}</p>}
    <div className="mt-5 flex justify-end gap-2">
      <button className={quietBtn} onClick={onClose}>Cancel</button>
      <button className={primaryBtn} disabled={!result.ok} onClick={restore} data-testid="button-confirm-restore">Replace & restore</button>
    </div>
  </Modal>;
}
