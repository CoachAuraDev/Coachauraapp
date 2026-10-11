import type { StateCreator, StoreApi } from "zustand";
import type { PersistOptions } from "zustand/middleware";
import { PERSISTENCE_FAILURE_MARKER } from "./persistence-error-marker.ts";

export type PersistenceHealth = {
  phase: "loading" | "ready" | "read-error" | "write-error";
  message: string;
};
let health: PersistenceHealth = { phase: typeof window === "undefined" ? "ready" : "loading", message: "" };
const listeners = new Set<() => void>();
export const getPersistenceHealth = () => health;
export const subscribePersistence = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
function report(phase: PersistenceHealth["phase"], message = "") {
  health = { phase, message };
  listeners.forEach((listener) => listener());
}
export class PersistenceFailure extends Error {
  constructor(message: string) { super(PERSISTENCE_FAILURE_MARKER + message); this.name = "PersistenceFailure"; }
}
let recoveryWrite = false;
let attempted: unknown = null;
export function withRecoveryWrite<T>(action: () => T): T {
  recoveryWrite = true;
  try { return action(); } finally { recoveryWrite = false; }
}
export function attemptedRecoveryState(): unknown { return attempted; }

/**
 * Same Zustand persisted envelope/API and storage key, but synchronous durable
 * writes happen BEFORE publishing state. No destructive storage migration.
 * This app uses synchronous localStorage; async writes are rejected explicitly.
 */
export function durablePersist<T, U>(
  config: StateCreator<T, [], []>,
  initialOptions: PersistOptions<T, U>,
): StateCreator<T, [], [["zustand/persist", U]]> {
  const creator: StateCreator<T> = (baseSet, get, baseApi) => {
    let options = { version: 0, ...initialOptions };
    let hydrated = false;
    let blocked = false;
    let hydrating: Promise<void> | null = null;
    const before = new Set<(state: T) => void>();
    const after = new Set<(state: T) => void>();
    function storage() {
      if (!options.storage) throw new Error("Local storage is unavailable. Check device/browser storage permissions.");
      return options.storage;
    }
    function write(state: T) {
      const partial = options.partialize ? options.partialize(state) : state as unknown as U;
      const result = storage().setItem(options.name, { state: partial, version: options.version });
      if (result && typeof (result as Promise<void>).then === "function") {
        throw new Error("Asynchronous storage is not supported by this synchronous saving path.");
      }
    }
    const commit = ((patch: T | Partial<T> | ((state: T) => T | Partial<T>), replace = false) => {
      const current = get();
      const change = typeof patch === "function" ? (patch as (state: T) => T | Partial<T>)(current) : patch;
      const next = replace ? change as T : { ...current, ...change };
      if (options.partialize) {
        const previous = options.partialize(current) as Record<string, unknown>;
        const incoming = options.partialize(next) as Record<string, unknown>;
        if (Object.keys(incoming).every((key) => Object.is(previous[key], incoming[key]))) {
          baseSet(next, true);
          return;
        }
      }
      attempted = options.partialize ? options.partialize(next) : next;
      try {
        if (blocked && !recoveryWrite) throw new Error("Saved data has not been safely loaded. Retry loading or restore a verified backup.");
        write(next);
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Storage write failed.";
        report(blocked ? "read-error" : "write-error", `Not saved. The failed action was not applied. Previous saved data is unchanged. ${detail}`);
        throw new PersistenceFailure(detail);
      }
      attempted = null;
      blocked = false;
      if (recoveryWrite) hydrated = true;
      baseSet(next, true);
      report("ready");
    }) as StoreApi<T>["setState"];
    baseApi.setState = commit;
    const api = baseApi as StoreApi<T> & { persist: {
      setOptions: (next: Partial<PersistOptions<T, U>>) => void;
      getOptions: () => PersistOptions<T, U>;
      clearStorage: () => void;
      rehydrate: () => Promise<void>;
      hasHydrated: () => boolean;
      onHydrate: (fn: (state: T) => void) => () => void;
      onFinishHydration: (fn: (state: T) => void) => () => void;
    } };
    api.persist = {
      setOptions: (next) => { options = { ...options, ...next }; },
      getOptions: () => options,
      clearStorage: () => { storage().removeItem(options.name); },
      hasHydrated: () => hydrated,
      onHydrate: (fn) => { before.add(fn); return () => { before.delete(fn); }; },
      onFinishHydration: (fn) => { after.add(fn); return () => { after.delete(fn); }; },
      rehydrate: () => {
        if (hydrating) return hydrating;
        hydrating = (async () => {
          report("loading");
          hydrated = false;
          before.forEach((fn) => fn(get()));
          const finish = options.onRehydrateStorage?.(get());
          try {
            const saved = await storage().getItem(options.name);
            if (saved && (saved.version ?? 0) !== options.version) throw new Error("Incompatible saved-data version. Export the original data before recovery.");
            const next = saved
              ? options.merge ? options.merge(saved.state, get()) : { ...get(), ...saved.state }
              : get();
            baseSet(next as T, true);
            hydrated = true;
            blocked = false;
            attempted = null;
            report("ready");
            finish?.(get(), undefined);
            after.forEach((fn) => fn(get()));
          } catch (error) {
            blocked = true;
            report("read-error", `Your saved data could not be loaded. It has not been changed. ${error instanceof Error ? error.message : "Storage read failed."}`);
            finish?.(undefined, error);
            throw error;
          }
        })().finally(() => { hydrating = null; });
        return hydrating;
      },
    };
    const initial = config(commit, get, baseApi);
    if (!options.skipHydration) queueMicrotask(() => { void api.persist.rehydrate().catch(() => {}); });
    return initial;
  };
  return creator as StateCreator<T, [], [["zustand/persist", U]]>;
}
