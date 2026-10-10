// Last-opened overlay consumes Android Back before page navigation.
const handlers: Array<() => void> = [];

export function registerNativeBackHandler(handler: () => void): () => void {
  handlers.push(handler);
  return () => {
    const index = handlers.indexOf(handler);
    if (index >= 0) handlers.splice(index, 1);
  };
}

export function consumeNativeBack(): boolean {
  const top = handlers.at(-1);
  if (!top) return false;
  top();
  return true;
}
