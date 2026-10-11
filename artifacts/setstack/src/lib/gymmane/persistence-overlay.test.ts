import test from "node:test";
import assert from "node:assert/strict";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { PersistenceFailure } from "./durable-persistence.ts";
import { isHandledPersistenceFailure } from "./persistence-error-marker.ts";

test("TEST actual overlay transport rejects handled storage failures and retains unexpected errors", () => {
  // Exercise the installed plugin, including its reconstruction of Error.name.
  const plugin = runtimeErrorOverlay({ filter: (e) => !isHandledPersistenceFailure(e) });
  let receive: ((data: { message: string; stack: string }, client: { send: (...args: unknown[]) => void }) => void) | undefined;
  const sent: unknown[] = [], logged: string[] = [];
  const server = {
    ws: { on: (_name: string, callback: typeof receive) => { receive = callback; } },
    moduleGraph: { urlToModuleMap: new Map() },
    config: { logger: { error: (message: string) => logged.push(message) } },
  };
  const setup = plugin.configureServer;
  assert.equal(typeof setup, "function");
  if (typeof setup !== "function") throw new Error("Overlay API changed; review filter.");
  setup.call({} as never, server as never);
  assert.ok(receive);
  const client = { send: (...args: unknown[]) => { sent.push(args); } };
  const failure = new PersistenceFailure("TEST quota exceeded");
  receive({ message: failure.message, stack: failure.stack! }, client); // no name in wire format
  assert.equal(sent.length, 0);
  assert.equal(logged.length, 0);
  receive({ message: "TEST unexpected bug", stack: "Error: TEST unexpected bug\n    at run (http://localhost/src/other.ts:1:1)" }, client);
  assert.equal(sent.length, 2, "unexpected errors still trigger overlay and parent notification");
  assert.equal(logged.length, 1);
  assert.equal(isHandledPersistenceFailure({ name: "Error", message: "Quota exceeded" }), false,
    "an arbitrary quota error without the handled marker must not be hidden");
});
