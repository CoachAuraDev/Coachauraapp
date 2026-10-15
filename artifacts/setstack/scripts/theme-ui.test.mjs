import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { seedClients } from "../src/lib/gymmane/seed.ts";

const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const repositoryDirectory = fileURLToPath(new URL("../../../", import.meta.url));
const clientId = "seed-amina";
const appearances = ["default", "orange-charcoal", "orange-light-grey", "light-lime-charcoal", "light-lime-grey"];
const themeSwatches = new Map();

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

function browserBinary() {
  return process.env.CHROME_BIN ?? "/repl/tools/bin/chromium";
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
      if (message.error) waiting.reject(new Error(message.error.message));
      else waiting.resolve(message.result);
    });
  }

  send(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const response = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.exceptionDetails) {
      throw new Error(response.exceptionDetails.text ?? "Browser expression failed.");
    }
    return response.result.value;
  }

  async click(testId) {
    const found = await this.evaluate(`(() => {
      const node = document.querySelector('[data-testid="${testId}"]');
      if (!node) return false;
      node.click();
      return true;
    })()`);
    assert.equal(found, true, `Missing clickable element ${testId}`);
  }

  async fill(testId, value, blur = false) {
    // Dispatch the rendered React handler directly; untrusted input events and
    // keyboard selection were not reliable for controlled number inputs in Chromium.
    const input = await this.evaluate(`(() => {
      const node = document.querySelector('[data-testid="${testId}"]');
      if (!node) return null;
      const prototype = node instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value").set.call(node, ${JSON.stringify(String(value))});
      const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
      const props = key && node[key];
      if (!props?.onChange) return null;
      props.onChange({ target: node, currentTarget: node });
      return { value: node.value, hasBlur: typeof props.onBlur === "function" };
    })()`);
    assert.ok(input, `Missing React input handler for ${testId}`);
    assert.equal(input.value, String(value));
    await new Promise((resolve) => setTimeout(resolve, 30));
    if (blur) {
      const blurred = await this.evaluate(`(() => {
        const node = document.querySelector('[data-testid="${testId}"]');
        const key = node && Object.keys(node).find((name) => name.startsWith("__reactProps$"));
        const props = key && node[key];
        if (!props?.onBlur) return false;
        props.onBlur({ target: node, currentTarget: node });
        return true;
      })()`);
      assert.equal(blurred, true, `Missing blur handler for ${testId}`);
    }
  }

  async close() {
    this.socket.close();
  }
}

async function openPage(debugPort) {
  const targetResponse = await fetch(`http://127.0.0.1:${debugPort}/json/new?about:blank`, { method: "PUT" });
  if (!targetResponse.ok) throw new Error(`Could not open Chromium page: ${targetResponse.status}`);
  const target = await targetResponse.json();
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

async function navigate(page, url, selector) {
  await page.send("Page.navigate", { url });
  await waitFor(`route ${url}`, () => page.evaluate("location.href"), (href) => href === url);
  await waitFor(`page content ${selector}`, () => page.evaluate(
    `document.querySelector('[data-testid="${selector}"]') !== null`,
  ));
}

async function storedState(page) {
  const raw = await page.evaluate('localStorage.getItem("setstack-v1")');
  assert.ok(raw, "CoachAura storage should be present");
  return JSON.parse(raw).state;
}

async function assertAppearance(page, expected) {
  const actual = await waitFor(
    `appearance ${expected}`,
    () => page.evaluate(`({
      appearance: document.documentElement.dataset.appearance ?? "default",
      dark: document.documentElement.classList.contains("dark")
    })`),
    (value) => value.appearance === expected && value.dark === !["orange-light-grey", "light-lime-grey"].includes(expected),
  );
  assert.equal(actual.appearance, expected);
}

async function exerciseProfileAndMap(page, baseUrl, index) {
  await navigate(page, `${baseUrl}/clients/${clientId}`, "button-client-start-session");
  assert.match(await page.evaluate("document.querySelector('h1')?.textContent"), /Amina Okonkwo/);
  assert.equal(
    await page.evaluate('!!document.querySelector("[data-testid=\\"client-training-analytics\\"]")'),
    false,
    "Analytics should not appear on the client Overview tab",
  );
  const measurement = (68.2 + index / 10).toFixed(1);
  await page.fill("input-bodyweight", measurement);
  await page.click("button-add-bodyweight");
  await waitFor("new client measurement", async () => {
    const client = (await storedState(page)).clients.find((item) => item.id === clientId);
    return client?.bodyweight.at(-1)?.kg;
  }, (weight) => weight === Number(measurement));

  await navigate(page, `${baseUrl}/clients/${clientId}?tab=muscles`, "client-training-analytics");
  const overviewCharts = await page.evaluate(`({
    muscle: !!document.querySelector('[data-testid="card-client-muscle-balance"] svg.recharts-surface'),
    weekly: !!document.querySelector('[data-testid="card-client-weekly-sets"] svg.recharts-surface'),
    strength: !!document.querySelector('[data-testid="card-client-strength-trend"] svg.recharts-surface'),
    themeChartColor: getComputedStyle(document.documentElement).getPropertyValue("--chart-1").trim(),
    radarUsesThemeToken: document.querySelector('[data-testid="card-client-muscle-balance"] svg')?.innerHTML.includes("hsl(var(--chart-1))"),
    viewportWidth: window.innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    strengthOptions: document.querySelectorAll('[data-testid="select-client-strength-exercise"] option').length,
    weeklyTotal: document.querySelector('[data-testid="card-client-weekly-sets"] [aria-label$="working sets this week"]')?.textContent
  })`);
  assert.ok(overviewCharts.muscle, "Muscle activity tab should render the actual-data muscle radar");
  assert.ok(overviewCharts.weekly, "Muscle activity tab should render the current week set chart");
  assert.ok(overviewCharts.strength, "Muscle activity tab should render the selected exercise strength chart");
  assert.ok(overviewCharts.themeChartColor, "Chart palette tokens should be defined for every selected theme");
  assert.ok(overviewCharts.radarUsesThemeToken, "The radar should use the selected chart palette token");
  assert.ok(overviewCharts.pageWidth <= overviewCharts.viewportWidth, "The muscle activity tab should not overflow horizontally on a phone-width viewport");
  assert.ok(overviewCharts.strengthOptions > 0, "The strength chart should offer exercises from this client's history");
  assert.match(overviewCharts.weeklyTotal, /^\d+ sets$/);
  assert.ok(Number(await page.evaluate(
    'document.querySelector(\'[data-testid="text-muscle-working-sets"]\')?.textContent',
  )) > 0, "The profile chart should show completed working sets");
  await page.click("button-muscle-period-30");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="button-muscle-period-30"]\')?.getAttribute("aria-pressed")',
  ), "true");
  await page.click("button-muscle-period-7");
  await page.click("button-muscle-view-back");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="button-muscle-view-back"]\')?.getAttribute("aria-selected")',
  ), "true");
  await page.click("button-muscle-view-front");
  await page.click("button-muscle-chest");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="text-selected-muscle"]\')?.textContent',
  ), "Chest");

  const chartState = await page.evaluate(`({
    weeklyLoad: document.querySelector('[data-testid="text-selected-weekly-load"]')?.textContent,
    chestColor: getComputedStyle(document.querySelector('[data-testid="region-muscle-chest"]')).fill,
    map: !!document.querySelector('[data-testid="muscle-map"]'),
    contributors: !!document.querySelector('[data-testid^="row-muscle-contributor-"]')
  })`);
  assert.ok(chartState.map);
  assert.ok(chartState.contributors, "The selected muscle should show contributing exercises");
  assert.ok(Number(chartState.weeklyLoad) > 0);
  themeSwatches.set(appearances[index], chartState.chestColor);
}

async function muscleChartSnapshot(page, baseUrl, clientId) {
  await navigate(page, `${baseUrl}/clients/${clientId}?tab=muscles&period=7`, "dashboard-muscle-activity");
  await page.click("button-muscle-chest");
  return await page.evaluate(`({
    workingSets: Number(document.querySelector('[data-testid="text-muscle-working-sets"]')?.textContent),
    completedSessions: Number(document.querySelector('[data-testid="text-muscle-session-count"]')?.textContent),
    chest: {
      intensity: document.querySelector('[data-testid="region-muscle-chest"]')?.getAttribute("data-intensity"),
      workload: document.querySelector('[data-testid="region-muscle-chest"]')?.getAttribute("aria-label"),
      totalSets: document.querySelector('[data-testid="text-selected-total-sets"]')?.textContent,
      directIndirect: document.querySelector('[data-testid="text-selected-direct-indirect"]')?.textContent,
      weightedSets: document.querySelector('[data-testid="text-selected-weighted-sets"]')?.textContent,
      weeklyLoad: document.querySelector('[data-testid="text-selected-weekly-load"]')?.textContent
    }
  })`);
}

async function correctSavedSessionAndVerifyCharts(page, baseUrl) {
  const aminaBeforeCorrection = await muscleChartSnapshot(page, baseUrl, "seed-amina");
  const leoBeforeCorrection = await muscleChartSnapshot(page, baseUrl, "seed-leo");
  const beforeState = await storedState(page);
  const amina = beforeState.clients.find((item) => item.id === "seed-amina");
  const session = amina?.sessions.find((item) => item.id === "seed-amina-0");
  assert.ok(session, "Amina's recent completed workout should be available in client history");
  const correctedDate = new Date(Date.parse(`${session.date}T12:00:00.000Z`) - 8 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  const movedWorkingSets = session.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((set) => set.reps > 0 && set.kind !== "warmup").length,
    0,
  );
  assert.ok(movedWorkingSets > 0, "The session being corrected should contribute working sets");

  await navigate(page, `${baseUrl}/clients/seed-amina?tab=history`, "button-client-start-session");
  const historyOpened = await page.evaluate(`(() => {
    const edit = document.querySelector('[data-testid="button-edit-session-seed-amina-0"]');
    const details = edit?.closest("details");
    details?.querySelector("summary")?.click();
    return !!details?.open;
  })()`);
  assert.equal(historyOpened, true, "Open the completed session from Amina's workout history");
  await page.click("button-edit-session-seed-amina-0");
  await waitFor("saved workout editor", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') !== null',
  ));
  await page.fill("input-edit-session-date", correctedDate);
  await page.click("button-editor-save");
  await waitFor("saved workout correction", async () => {
    const client = (await storedState(page)).clients.find((item) => item.id === "seed-amina");
    return client?.sessions.find((item) => item.id === "seed-amina-0")?.date;
  }, (date) => date === correctedDate);

  const aminaAfterCorrection = await muscleChartSnapshot(page, baseUrl, "seed-amina");
  assert.equal(
    aminaAfterCorrection.workingSets,
    aminaBeforeCorrection.workingSets - movedWorkingSets,
    "Moving the completed workout out of the last 7 days should remove its working sets from the chart",
  );
  assert.equal(
    aminaAfterCorrection.completedSessions,
    aminaBeforeCorrection.completedSessions - 1,
    "The corrected workout should no longer count as a recent completed session",
  );
  assert.notEqual(
    aminaAfterCorrection.chest.workload,
    aminaBeforeCorrection.chest.workload,
    "The chest region on the muscle map should reflect the corrected workout date",
  );
  assert.notEqual(
    aminaAfterCorrection.chest.directIndirect,
    aminaBeforeCorrection.chest.directIndirect,
    "The selected muscle totals should update after the correction",
  );

  assert.deepEqual(
    await muscleChartSnapshot(page, baseUrl, "seed-leo"),
    leoBeforeCorrection,
    "Correcting Amina's workout must not change Leo's muscle chart",
  );

  await page.send("Page.reload", { ignoreCache: true });
  await waitFor("reloaded client muscle dashboard", () => page.evaluate(
    'document.querySelector(\'[data-testid="dashboard-muscle-activity"]\') !== null',
  ));
  const savedState = await storedState(page);
  assert.equal(
    savedState.clients.find((item) => item.id === "seed-amina")?.sessions.find((item) => item.id === "seed-amina-0")?.date,
    correctedDate,
    "The saved correction should persist after reloading",
  );
  assert.deepEqual(
    await muscleChartSnapshot(page, baseUrl, "seed-amina"),
    aminaAfterCorrection,
    "Amina's corrected chart should remain accurate after reloading",
  );
  assert.deepEqual(
    await muscleChartSnapshot(page, baseUrl, "seed-leo"),
    leoBeforeCorrection,
    "Leo's chart should remain unchanged after reloading",
  );
}

async function exerciseWorkout(page, baseUrl) {
  await navigate(page, `${baseUrl}/clients/${clientId}`, "button-client-start-session");
  await page.click("button-client-start-session");
  await waitFor("live workout logger", () => page.evaluate(
    'document.querySelector(\'[data-testid="panel-workout-logger"]\') !== null',
  ));
  assert.ok(await page.evaluate('!!document.querySelector(\'[data-testid="panel-rest-timer"]\')'));

  await page.click("button-rest-settings");
  await page.fill("input-rest-seconds", "75", true);
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="input-rest-seconds"]\')?.value',
  ), "75");
  assert.equal((await storedState(page)).draft.restDurationSeconds, 75);
  await waitFor("configured rest duration", () => page.evaluate(
    'document.querySelector(\'[data-testid="text-rest-remaining"]\')?.textContent',
  ), (value) => value === "1:15");
  await page.click("button-rest-start");
  await waitFor("running rest timer", () => page.evaluate(
    'document.querySelector(\'[data-testid="text-rest-state"]\')?.textContent',
  ), (value) => value === "Resting");
  await page.click("button-rest-pause");
  await waitFor("paused rest timer", () => page.evaluate(
    'document.querySelector(\'[data-testid="text-rest-state"]\')?.textContent',
  ), (value) => value === "Paused");
  await page.click("button-rest-start");
  await page.click("button-rest-bump");
  await page.click("button-rest-pause");
  const pausedTime = await page.evaluate(
    'document.querySelector(\'[data-testid="text-rest-remaining"]\')?.textContent',
  );
  assert.ok(["1:29", "1:30"].includes(pausedTime), `Timer adjustment should be visible; got ${pausedTime}`);

  await page.fill("input-set-weight", "52.5");
  await page.fill("input-set-reps", "7");
  await page.fill("input-set-rir", "2");
  await page.click("button-log-set");
  await waitFor("logged test set", () => page.evaluate(
    'document.querySelector(\'[data-testid="list-current-sets"]\')?.textContent',
  ), (text) => text?.includes("52.5 kg × 7"));
  await page.click("button-rest-pause");
  await waitFor("paused post-set timer", () => page.evaluate(
    'document.querySelector(\'[data-testid="text-rest-state"]\')?.textContent',
  ), (value) => value === "Paused");

  await page.fill("input-set-weight", "60.25");
  await page.fill("input-set-reps", "5");
  await page.fill("input-set-rir", "1");
  await page.click("button-minimize-session");
  await waitFor("minimized workout", () => page.evaluate(
    'document.querySelector(\'[data-testid="button-resume-session"]\') !== null',
  ));
  return await storedState(page);
}

async function changeThemeAndReload(page, baseUrl, nextAppearance, savedClients) {
  await navigate(page, `${baseUrl}/settings`, "select-appearance");
  await page.click(`button-appearance-${nextAppearance}`);
  await assertAppearance(page, nextAppearance);
  await navigate(page, `${baseUrl}/clients/${clientId}`, "panel-workout-logger");
  await assertAppearance(page, nextAppearance);

  const state = await storedState(page);
  assert.deepEqual(state.clients, savedClients, "Changing appearance and reloading must not change client records");
  const active = state.draft;
  assert.equal(active?.clientId, clientId, "The in-progress workout should survive the reload");
  assert.equal(active?.exercises[0]?.sets[0]?.weight, 52.5);
  assert.equal(active?.exercises[0]?.sets[0]?.reps, 7);
  assert.equal(active?.exercises[0]?.sets[0]?.rpe, 8);
  assert.deepEqual(active?.entries?.[active.exercises[active.activeIndex]?.id], {
    weightKg: 60.25,
    reps: 5,
    rir: 1,
    kind: "normal",
    inputs: { weight: "60.25", reps: "5", rir: "1", unit: "kg" },
  });
  await waitFor("rest timer restored after reload", () => page.evaluate(
    'document.querySelector(\'[data-testid="text-rest-state"]\')?.textContent',
  ), (value) => value === "Paused");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="text-rest-remaining"]\')?.textContent',
  ), "1:15");
  assert.ok(await page.evaluate(
    'document.querySelector(\'[data-testid="list-current-sets"]\')?.textContent.includes("52.5 kg × 7")',
  ), "The logged set should still be visible after the reload");
}

test("profile charts, workout logging, numeric inputs, and rest timer work across CoachAura themes", { timeout: 120000 }, async (t) => {
  const chrome = browserBinary();
  try {
    await access(chrome);
  } catch {
    assert.fail(`Chromium is required for this UI regression test. Set CHROME_BIN to its executable path (checked ${chrome}).`);
  }

  const appPort = await availablePort();
  const debugPort = await availablePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "coachaura-theme-ui-"));
  let serverOutput = "";
  const server = spawn(path.join(appDirectory, "node_modules/.bin/vite"), [
    "--config", "vite.config.ts", "--host", "127.0.0.1", "--port", String(appPort), "--strictPort",
  ], {
    cwd: appDirectory,
    env: { ...process.env, PORT: String(appPort), BASE_PATH: "/" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (chunk) => { serverOutput += chunk; });
  server.stderr.on("data", (chunk) => { serverOutput += chunk; });
  let browser;
  let page;
  t.after(async () => {
    await page?.close().catch(() => {});
    if (browser?.pid && browser.exitCode == null) {
      try { process.kill(-browser.pid, "SIGTERM"); } catch { browser.kill("SIGTERM"); }
    }
    if (server.exitCode == null) server.kill("SIGTERM");
    const awaitExit = async (child) => {
      if (!child || child.exitCode != null) return;
      await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 3000))]);
    };
    await Promise.all([awaitExit(browser), awaitExit(server)]);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(profileDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        break;
      } catch (error) {
        if (attempt === 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }
  });

  await waitFor("Vite dev server", async () => {
    try {
      const response = await fetch(baseUrl);
      return response.ok;
    } catch {
      if (server.exitCode != null) throw new Error(`Vite exited early.\n${serverOutput}`);
      return false;
    }
  });

  browser = spawn(chrome, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--remote-allow-origins=*",
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profileDirectory}`,
    "about:blank",
  ], { stdio: "ignore", detached: true });
  await waitFor("Chromium DevTools endpoint", async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      return response.ok;
    } catch {
      if (browser.exitCode != null) throw new Error(`Chromium exited before startup (${browser.exitCode}).`);
      return false;
    }
  });
  page = await openPage(debugPort);
  await page.send("Emulation.setDeviceMetricsOverride", {
    width: 402,
    height: 874,
    deviceScaleFactor: 1,
    mobile: true,
  });

  const initialClients = seedClients();
  const fixture = JSON.stringify({
    state: { clients: initialClients, unit: "kg", appearance: "default", draft: null, custom: [], templates: [] },
    version: 0,
  });
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (location.host === "127.0.0.1:${appPort}" && !localStorage.getItem("setstack-v1")) {
      localStorage.setItem("setstack-v1", ${JSON.stringify(fixture)});
    }`,
  });
  await navigate(page, `${baseUrl}/clients/${clientId}`, "button-client-start-session");

  for (let index = 0; index < appearances.length; index += 1) {
    const appearance = appearances[index];
    await assertAppearance(page, appearance);
    await exerciseProfileAndMap(page, baseUrl, index);
    const stateBeforeThemeChange = await exerciseWorkout(page, baseUrl);
    const nextAppearance = appearances[(index + 1) % appearances.length];
    await changeThemeAndReload(page, baseUrl, nextAppearance, stateBeforeThemeChange.clients);

    if (index < appearances.length - 1) {
      await page.click("button-finish-session");
      await waitFor("completed workout", () => page.evaluate(
        'document.querySelector(\'[data-testid="panel-workout-logger"]\') === null',
      ));
      const client = (await storedState(page)).clients.find((item) => item.id === clientId);
      const lastExercise = client.sessions.at(-1)?.exercises[0];
      assert.equal(lastExercise?.sets[0]?.weight, 52.5);
      assert.equal(lastExercise?.sets[0]?.reps, 7);
      assert.equal(lastExercise?.sets[0]?.rpe, 8);
    }
  }

  assert.equal(themeSwatches.size, appearances.length, "Each supported appearance should have been checked");
  assert.equal(themeSwatches.get("default"), themeSwatches.get("light-lime-charcoal"), "The charcoal lime theme reuses CoachAura's existing dark muscle scale");
  assert.notEqual(themeSwatches.get("orange-charcoal"), themeSwatches.get("default"));
  assert.notEqual(themeSwatches.get("orange-light-grey"), themeSwatches.get("default"));
  assert.notEqual(themeSwatches.get("light-lime-grey"), themeSwatches.get("default"));
  await page.click("button-finish-session");
  await waitFor("final workout completion", () => page.evaluate(
    'document.querySelector(\'[data-testid="panel-workout-logger"]\') === null',
  ));
  const completed = (await storedState(page)).clients.find((item) => item.id === clientId);
  assert.equal(completed.sessions.at(-1)?.exercises[0]?.sets[0]?.weight, 52.5);
  assert.equal(completed.sessions.at(-1)?.exercises[0]?.sets[0]?.reps, 7);
  assert.equal(completed.sessions.at(-1)?.exercises[0]?.sets[0]?.rpe, 8);
  await assertAppearance(page, "default");
  await correctSavedSessionAndVerifyCharts(page, baseUrl);
  await navigate(page, `${baseUrl}/clients/${clientId}?tab=muscles`, "client-training-analytics");
  await page.evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem("setstack-v1"));
    const client = data.state.clients.find((item) => item.id === "${clientId}");
    client.sessions = [];
    localStorage.setItem("setstack-v1", JSON.stringify(data));
  })()`);
  await page.send("Page.reload");
  await waitFor("empty client overview", () => page.evaluate(
    'document.querySelector(\'[data-testid="card-client-muscle-balance"]\')?.textContent.includes("No mapped workout activity yet")',
  ));
  const emptyOverview = await page.evaluate(`({
    strength: document.querySelector('[data-testid="card-client-strength-trend"]')?.textContent.includes("No strength history yet"),
    weeklyTotal: document.querySelector('[data-testid="card-client-weekly-sets"] [aria-label$="working sets this week"]')?.textContent
  })`);
  assert.equal(emptyOverview.strength, true, "The strength card should not invent a performance history");
  assert.equal(emptyOverview.weeklyTotal, "0 sets", "The empty client should show zero recorded working sets");
});
