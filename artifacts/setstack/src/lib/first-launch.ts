export const FIRST_LAUNCH_COMPLETE_KEY = "coachaura-intro-complete-v1";
const WORKSPACE_STORAGE_KEY = "setstack-v1";
const COMPLETE_VALUE = "1";

export type IntroStorage = Pick<Storage, "getItem" | "setItem">;

/**
 * New installs get the introduction. A workspace written by an older CoachAura
 * version is treated as an existing installation, so app updates never gate
 * access to existing client or workout data.
 */
export function shouldShowFirstLaunchIntro(storage: IntroStorage | null): boolean {
  if (!storage) return false;
  try {
    if (storage.getItem(FIRST_LAUNCH_COMPLETE_KEY) === COMPLETE_VALUE) return false;
    if (storage.getItem(WORKSPACE_STORAGE_KEY) !== null) {
      storage.setItem(FIRST_LAUNCH_COMPLETE_KEY, COMPLETE_VALUE);
      return false;
    }
    return true;
  } catch {
    // An intro must never prevent the app or its storage-recovery screen from opening.
    return false;
  }
}

export function markFirstLaunchIntroComplete(storage: IntroStorage | null): boolean {
  if (!storage) return false;
  try {
    storage.setItem(FIRST_LAUNCH_COMPLETE_KEY, COMPLETE_VALUE);
    return true;
  } catch {
    // Continue into CoachAura even if this non-essential UI marker cannot be saved.
    return false;
  }
}
