// The dev overlay serializes message/stack but drops custom Error.name.
export const PERSISTENCE_FAILURE_MARKER = "[CoachAura persistence] ";
export function isHandledPersistenceFailure(error: { name?: string; message?: string }): boolean {
  return error.name === "PersistenceFailure" ||
    error.message?.startsWith(PERSISTENCE_FAILURE_MARKER) === true;
}
