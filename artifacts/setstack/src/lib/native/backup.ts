import { Filesystem, Directory, Encoding } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { isAndroidApp } from "./android";

export async function exportBackupFile(content: string, filename: string): Promise<"android" | "browser"> {
  if (isAndroidApp()) {
    const file = await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    // Cache is permitted by Capacitor's Android FileProvider; no broad storage
    // permission is needed. The user chooses where a permanent copy is saved.
    await Share.share({
      title: "CoachAura client backup",
      dialogTitle: "Save or share your CoachAura backup",
      files: [file.uri],
    });
    return "android";
  }
  const href = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = href;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
  return "browser";
}
