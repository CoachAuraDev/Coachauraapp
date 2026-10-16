export type SubmissionFingerprint = {
  key: string;
  at: number;
};

const DEFAULT_DUPLICATE_WINDOW_MS = 500;

/**
 * Suppress an identical submit that arrives immediately after the first one.
 * The caller should only record the fingerprint after confirming the action
 * took effect, so failed saves remain retryable.
 */
export function isRapidDuplicateSubmission(
  previous: SubmissionFingerprint | null,
  key: string,
  now: number,
  windowMs = DEFAULT_DUPLICATE_WINDOW_MS,
): boolean {
  if (!previous || previous.key !== key) return false;
  const elapsed = now - previous.at;
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed < windowMs;
}
