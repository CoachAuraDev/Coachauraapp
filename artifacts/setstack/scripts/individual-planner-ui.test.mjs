import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { kExercises } from "../src/lib/gymmane/catalog.ts";
import { DEFAULT_APPEARANCE } from "../src/lib/gymmane/appearance.ts";
import { INDIVIDUAL_PROFILE_ID } from "../src/lib/gymmane/models.ts";

const appDirectory = fileURLToPath(new URL("../", import.meta.url));

async function availablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitFor(description, read, predicate = Boolean, timeoutMs = 12000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await read();
    if (predicate(last)) return last;
    await new Promise((resolve) => setTimeout(resolve, 80));
  }
  throw new Error(`Timed out waiting for ${description}. Last value: ${String(last)}`);
}

class DevToolsPage {
  nextId = 0;
  pending = new Map();
  constructor(socket) {
    this.socket = socket;
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (!message.id) return;
      const waiting = this.pending.get(message.id);
      if (!waiting) return;
      this.pending.delete(message.id);
      clearTimeout(waiting.timeout);
      if (message.error) waiting.reject(new Error(message.error.message));
      else waiting.resolve(message.result);
    });
  }
  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`DevTools ${method} timed out.`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression, returnByValue: true, awaitPromise: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? "Browser expression failed.");
    return response.result.value;
  }
  async click(testId) {
    const clicked = await this.evaluate(`(() => {
      const node = document.querySelector('[data-testid="${testId}"]');
      if (!node || node.disabled) return false;
      node.click();
      return true;
    })()`);
    assert.equal(clicked, true, `Missing or disabled control ${testId}`);
  }
  async fill(testId, value) {
    const result = await this.evaluate(`(() => {
      const node = document.querySelector('[data-testid="${testId}"]');
      if (!node) return null;
      const prototype = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, ${JSON.stringify(String(value))});
      const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
      const props = key && node[key];
      if (!props?.onChange) return null;
      props.onChange({ target: node, currentTarget: node });
      return node.value;
    })()`);
    assert.equal(result, String(value), `Could not update ${testId}`);
    await new Promise((resolve) => setTimeout(resolve, 30));
  }
  close() { this.socket.close(); }
}

async function openPage(debugPort) {
  const response = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
  if (!response.ok) throw new Error(`Could not open Chromium page: ${response.status}`);
  const target = await response.json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener("open", resolve, { once: true });
    socket.addEventListener("error", reject, { once: true });
  });
  const page = new DevToolsPage(socket);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  return page;
}

async function reloadAndWait(page, selector) {
  const marker = `__coachaura_planner_reload_${Date.now()}`;
  const { identifier } = await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window[${JSON.stringify(marker)}] = true;`,
  });
  await page.send("Page.reload", { ignoreCache: true });
  await waitFor("app reload", () => page.evaluate(
    `window[${JSON.stringify(marker)}] === true && !!document.querySelector('[data-testid="${selector}"]')`,
  ));
  await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
}

test("personal workout plans can be built, edited, run, saved and deleted without affecting clients", { timeout: 120000 }, async (t) => {
  const chrome = process.env.CHROME_BIN ?? "/repl/tools/bin/chromium";
  try { await access(chrome); } catch {
    assert.fail(`Chromium is required for the planner UI test (checked ${chrome}).`);
  }

  const appPort = await availablePort();
  const debugPort = await availablePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "coachaura-planner-ui-"));
  let serverOutput = "";
  const server = spawn(path.join(appDirectory, "node_modules/.bin/vite"), [
    "--config", "vite.config.ts", "--host", "127.0.0.1", "--port", String(appPort), "--strictPort",
  ], { cwd: appDirectory, env: { ...process.env, PORT: String(appPort), BASE_PATH: "/" }, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", (chunk) => { serverOutput += chunk; });
  server.stderr.on("data", (chunk) => { serverOutput += chunk; });
  let browser;
  let page;
  t.after(async () => {
    page?.close();
    if (browser?.pid && browser.exitCode == null) {
      try { process.kill(-browser.pid, "SIGTERM"); } catch { browser.kill("SIGTERM"); }
    }
    if (server.exitCode == null) server.kill("SIGTERM");
    await Promise.all([browser, server].filter(Boolean).map(async (child) => {
      if (child.exitCode == null) await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
    }));
    await rm(profileDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }).catch(() => {});
  });

  await waitFor("Vite dev server", async () => {
    try { return (await fetch(baseUrl)).ok; } catch {
      if (server.exitCode != null) throw new Error(`Vite exited early.\n${serverOutput}`);
      return false;
    }
  });
  browser = spawn(chrome, [
    "--headless=new", "--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage",
    "--remote-allow-origins=*", `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDirectory}`, "about:blank",
  ], { stdio: "ignore", detached: true });
  await waitFor("Chromium DevTools endpoint", async () => {
    try { return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok; } catch {
      if (browser.exitCode != null) throw new Error(`Chromium exited early (${browser.exitCode}).`);
      return false;
    }
  });
  page = await openPage(debugPort);
  await page.send("Emulation.setDeviceMetricsOverride", { width: 402, height: 874, deviceScaleFactor: 1, mobile: true });
  const stored = {
    state: {
      clients: [], trainingMode: "individual",
      individualProfile: { restSeconds: 90, sessions: [], plans: [] },
      unit: "kg", appearance: DEFAULT_APPEARANCE, draft: null, custom: [], templates: [],
    },
    version: 0,
  };
  const { identifier } = await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `localStorage.setItem("setstack-v1", ${JSON.stringify(JSON.stringify(stored))}); localStorage.setItem("coachaura-intro-complete-v1", "1");`,
  });
  await page.send("Page.navigate", { url: baseUrl });
  await waitFor("Individual Mode dashboard", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="individual-bottom-navigation"]\')',
  ));
  await page.send("Page.removeScriptToEvaluateOnNewDocument", { identifier });

  const firstId = kExercises[0].id;
  const secondId = kExercises[1].id;
  await page.click("tab-individual-exercises");
  await waitFor("planner sections", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="tab-individual-exercises-library"]\')',
  ));
  await page.click("tab-individual-exercises-library");
  await page.click(`button-select-library-exercise-${firstId}`);
  await page.fill("input-new-plan-name", "TEST Push Day");
  await page.click("button-create-plan-with-exercise");
  await waitFor("created workout plan", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="list-individual-plans"]\')',
  ));
  let state = await page.evaluate('JSON.parse(localStorage.getItem("setstack-v1")).state');
  let plan = state.individualProfile.plans.at(-1);
  assert.equal(plan.name, "TEST Push Day");
  assert.deepEqual(plan.exerciseIds, [firstId]);

  await page.click("tab-individual-exercises-library");
  await page.click(`button-select-library-exercise-${secondId}`);
  await page.click(`button-add-exercise-to-plan-${plan.id}`);
  state = await page.evaluate('JSON.parse(localStorage.getItem("setstack-v1")).state');
  plan = state.individualProfile.plans.find((item) => item.id === plan.id);
  assert.deepEqual(plan.exerciseIds, [firstId, secondId]);

  await page.click("tab-individual-exercises-library");
  await page.click(`button-select-library-exercise-${secondId}`);
  assert.equal(await page.evaluate(`document.querySelector('[data-testid="button-add-exercise-to-plan-${plan.id}"]')?.disabled`), true);
  await page.click("button-close-dialog");

  await page.click("tab-individual-exercises-plans");
  await page.click(`button-edit-individual-plan-${plan.id}`);
  await waitFor("plan editor controls", () => page.evaluate(`!!document.querySelector('[data-testid="button-toggle-targets-${secondId}"]')`));
  await page.click(`button-toggle-targets-${secondId}`);
  await page.click(`button-move-exercise-up-${secondId}`);
  await page.fill("input-routine-name", "TEST Upper Day");
  await page.click("button-save-routine");
  state = await page.evaluate('JSON.parse(localStorage.getItem("setstack-v1")).state');
  plan = state.individualProfile.plans.find((item) => item.id === plan.id);
  assert.equal(plan.name, "TEST Upper Day");
  assert.deepEqual(plan.exerciseIds, [secondId, firstId]);
  assert.deepEqual(state.clients, []);

  await reloadAndWait(page, "individual-bottom-navigation");
  await page.click("tab-individual-exercises");
  await waitFor("planner after reload", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="tab-individual-exercises-plans"]\')',
  ));
  await page.click("tab-individual-exercises-plans");
  state = await page.evaluate('JSON.parse(localStorage.getItem("setstack-v1")).state');
  plan = state.individualProfile.plans.find((item) => item.id === plan.id);
  assert.deepEqual(plan.exerciseIds, [secondId, firstId], "Saved plan order persists across reload");

  await page.click(`button-start-individual-plan-${plan.id}`);
  await waitFor("live logger", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="panel-workout-logger"]\')',
  ));
  state = await page.evaluate('JSON.parse(localStorage.getItem("setstack-v1")).state');
  assert.equal(state.draft.clientId, INDIVIDUAL_PROFILE_ID);
  assert.equal(state.draft.routineId, plan.id);
  assert.deepEqual(state.draft.exercises.map((exercise) => exercise.id), [secondId, firstId]);
  await page.fill("input-set-weight", "60");
  await page.fill("input-set-reps", "8");
  await page.click("button-log-set");
  await page.click("button-finish-session");
  state = await page.evaluate('JSON.parse(localStorage.getItem("setstack-v1")).state');
  assert.equal(state.draft, null);
  assert.equal(state.individualProfile.sessions.length, 1);
  assert.deepEqual(state.individualProfile.sessions[0].exercises[0].sets.map((set) => [set.weight, set.reps]), [[60, 8]]);
  assert.deepEqual(state.individualProfile.plans.find((item) => item.id === plan.id).exerciseIds, [secondId, firstId]);
  assert.deepEqual(state.clients, []);

  await page.click("tab-individual-exercises");
  await page.click("tab-individual-exercises-plans");
  await page.click(`button-delete-individual-plan-${plan.id}`);
  await page.click("button-confirm-delete-individual-plan");
  state = await page.evaluate('JSON.parse(localStorage.getItem("setstack-v1")).state');
  assert.equal(state.individualProfile.plans.length, 0);
  assert.equal(state.individualProfile.sessions.length, 1, "Plan deletion does not remove completed personal workout history");
  assert.deepEqual(state.clients, []);
});
