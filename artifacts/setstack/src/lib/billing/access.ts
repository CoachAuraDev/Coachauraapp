type EntitlementSource = "play" | "debug" | null;

let source: EntitlementSource = null;

/**
 * Runtime-only access signal. It is deliberately excluded from Zustand and
 * browser storage; release access can only be set after a live Play query.
 */
export function setBillingAccessSource(next: EntitlementSource, debugBuild = false): void {
  source = next === "debug" && !debugBuild ? null : next;
}

export function hasBillingLifetimeAccess(): boolean {
  return source === "play" || source === "debug";
}
