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
import { toDisplay, todayIso } from "../src/lib/gymmane/engine.ts";
import { effortFactorFromRpe } from "../src/lib/gymmane/muscle-activity.ts";

const appDirectory = fileURLToPath(new URL("../", import.meta.url));
const repositoryDirectory = fileURLToPath(new URL("../../../", import.meta.url));
const clientId = "seed-amina";
const appearances = ["default", "orange-charcoal"];
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
        reject(new Error(`DevTools ${method} timed out: ${JSON.stringify(params)}`));
      }, 15000);
      this.pending.set(id, { resolve, reject, timeout });
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

  async fillControlledValue(testId, value) {
    const changed = await this.evaluate(`(() => {
      const node = document.querySelector('[data-testid="${testId}"]');
      const key = node && Object.keys(node).find((name) => name.startsWith("__reactProps$"));
      const props = key && node[key];
      if (!props?.onChange) return false;
      props.onChange({ target: { value: ${JSON.stringify(String(value))} }, currentTarget: node });
      return true;
    })()`);
    assert.equal(changed, true, `Missing React input handler for ${testId}`);
    await new Promise((resolve) => setTimeout(resolve, 30));
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
  await page.send("Network.enable");
  page.pendingRequests = new Map();
  page.socket.addEventListener("message", (event) => {
    try {
      const message = JSON.parse(String(event.data));
      const params = message.params;
      if (message.method === "Network.requestWillBeSent") {
        page.pendingRequests.set(params.requestId, { url: params.request.url, type: params.type });
      } else if (message.method === "Network.loadingFinished" || message.method === "Network.loadingFailed") {
        page.pendingRequests.delete(params.requestId);
      }
    } catch {
      // Ignore non-JSON and unrelated DevTools messages.
    }
  });
  return page;
}

async function loadPage(page, method, params) {
  let listener;
  let timeout;
  let response;
  const readyEvent = method === "Page.navigate" ? "Page.domContentEventFired" : "Page.loadEventFired";
  const loaded = new Promise((resolve, reject) => {
    listener = (event) => {
      if (JSON.parse(String(event.data)).method === readyEvent) resolve();
    };
    page.socket.addEventListener("message", listener);
    timeout = setTimeout(() => reject(new Error(`${method} did not finish loading: ${JSON.stringify({ params, response, previousUrl: page.lastUrl, pendingRequests: [...(page.pendingRequests?.values() ?? [])] })}`)), 15000);
  });
  try {
    await Promise.all([page.send(method, params).then((result) => { response = result; }), loaded]);
    if (params.url) page.lastUrl = params.url;
  } finally {
    clearTimeout(timeout);
    page.socket.removeEventListener("message", listener);
  }
}

async function navigate(page, url, selector) {
  // Evaluations sent while the old document unloads can lose their response.
  await loadPage(page, "Page.navigate", { url });
  await waitFor(`route ${url}`, () => page.evaluate("location.href"), (href) => href === url);
  await waitFor(`page content ${selector}`, () => page.evaluate(
    `(() => ({ found: document.querySelector('[data-testid="${selector}"]') !== null, href: location.href, readyState: document.readyState, text: document.body?.innerText?.slice(0, 240) }))()`,
  ), (state) => state?.found === true);
}

async function reloadAndWait(page, description, selector) {
  const marker = `__coachaura_reloaded_${Date.now()}`;
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window[${JSON.stringify(marker)}] = true;`,
  });
  await loadPage(page, "Page.reload", { ignoreCache: true });
  await waitFor(description, () => page.evaluate(
    `window[${JSON.stringify(marker)}] === true && document.querySelector('[data-testid="${selector}"]') !== null`,
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
    (value) => value.appearance === expected && value.dark,
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
  assert.equal(
    await page.evaluate('document.querySelector(\'[data-testid="tab-muscles"]\')?.textContent.trim()'),
    "Muscle Analytics",
    "The client navigation should use the new Muscle Analytics label",
  );
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
  await page.fill("input-muscle-target-chest", "100");
  await page.click("button-save-muscle-targets");
  await waitFor("client-specific muscle target save", async () => {
    const state = await storedState(page);
    return state.clients.find((item) => item.id === clientId)?.muscleTargets?.chest;
  }, (target) => target === 100);
  assert.match(await page.evaluate(
    'document.querySelector(\'[data-testid="text-muscle-guidance-chest"]\')?.textContent',
  ), /Below coaching target/);
  assert.equal(
    (await storedState(page)).clients.find((item) => item.id === "seed-leo")?.muscleTargets,
    undefined,
    "Saving Amina's target must not alter another client",
  );
  await reloadAndWait(page, "reloaded muscle coaching targets", "client-training-analytics");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="input-muscle-target-chest"]\')?.value',
  ), "100", "Saved targets should be visible after reload");
  assert.match(await page.evaluate(
    'document.querySelector(\'[data-testid="text-muscle-guidance-chest"]\')?.textContent',
  ), /Below coaching target/, "Guidance should persist after reload");
  await page.fill("input-muscle-target-chest", "101");
  await page.click("button-save-muscle-targets");
  assert.match(await page.evaluate(
    'document.querySelector(\'[role="alert"]\')?.textContent',
  ), /from 0 to 100/, "Out-of-range targets should be rejected with a clear message");
  assert.equal(
    (await storedState(page)).clients.find((item) => item.id === clientId)?.muscleTargets?.chest,
    100,
    "An invalid edit must not overwrite the saved target",
  );
  await page.fill("input-muscle-target-chest", "");
  await page.click("button-save-muscle-targets");
  await waitFor("cleared client-specific muscle target", async () => {
    const state = await storedState(page);
    return state.clients.find((item) => item.id === clientId)?.muscleTargets;
  }, (targets) => targets === undefined);
  assert.match(await page.evaluate(
    'document.querySelector(\'[data-testid="text-muscle-guidance-chest"]\')?.textContent',
  ), /No target set/, "Clearing a target should remove its comparison");
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

async function muscleChartSnapshot(page, baseUrl, clientId, muscle = "chest", period = 7) {
  await navigate(page, `${baseUrl}/clients/${clientId}?tab=muscles&period=${period}`, "dashboard-muscle-activity");
  assert.equal(await page.evaluate(
    `document.querySelector('[data-testid="button-muscle-period-${period}"]')?.getAttribute("aria-pressed")`,
  ), "true", `The ${period}-day chart must be selected`);
  if (muscle === "triceps") await page.click("button-muscle-view-back");
  await page.click(`button-muscle-${muscle}`);
  return await page.evaluate(`({
    workingSets: Number(document.querySelector('[data-testid="text-muscle-working-sets"]')?.textContent),
    completedSessions: Number(document.querySelector('[data-testid="text-muscle-session-count"]')?.textContent),
    selected: {
      intensity: document.querySelector('[data-testid="region-muscle-${muscle}"]')?.getAttribute("data-intensity"),
      workload: document.querySelector('[data-testid="region-muscle-${muscle}"]')?.getAttribute("aria-label"),
      totalSets: document.querySelector('[data-testid="text-selected-total-sets"]')?.textContent,
      directIndirect: document.querySelector('[data-testid="text-selected-direct-indirect"]')?.textContent,
      weightedSets: document.querySelector('[data-testid="text-selected-weighted-sets"]')?.textContent,
      weeklyLoad: document.querySelector('[data-testid="text-selected-weekly-load"]')?.textContent,
      contributors: Array.from(document.querySelectorAll('[data-testid^="row-muscle-contributor-"]'))
        .map((row) => ({
          exerciseId: row.getAttribute("data-testid")?.replace("row-muscle-contributor-", ""),
          details: row.querySelector("p:last-child")?.textContent?.trim()
        }))
    },
    mapRegions: Array.from(document.querySelectorAll('[data-testid^="region-muscle-"]'))
      .map((region) => ({
        id: region.getAttribute("data-testid"),
        intensity: region.getAttribute("data-intensity"),
        workload: region.getAttribute("aria-label")
      }))
      .sort((a, b) => a.id.localeCompare(b.id))
  })`);
}

function parseContributorDetails(contributor) {
  assert.ok(contributor, "The selected exercise should have a contributor row");
  const match = contributor.details?.match(/^(\d+) direct · (\d+) indirect sets · ([\d.]+) weighted$/);
  assert.ok(match, `Contributor details should include direct, indirect, and weighted sets: ${contributor.details}`);
  return {
    directSets: Number(match[1]),
    indirectSets: Number(match[2]),
    weightedSets: Number(match[3]),
  };
}

async function verifyLastRecentWorkoutCorrection(page, baseUrl, fixtureClient) {
  const [session] = fixtureClient.sessions;
  assert.equal(fixtureClient.sessions.length, 1, "The isolated chart fixture must contain one historical workout");
  const fixtureId = fixtureClient.id;
  const sessionId = session.id;
  await page.evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem("setstack-v1"));
    data.state.clients = data.state.clients.filter((client) => client.id !== ${JSON.stringify(fixtureId)});
    data.state.clients.push(${JSON.stringify(fixtureClient)});
    localStorage.setItem("setstack-v1", JSON.stringify(data));
  })()`);
  await reloadAndWait(page, "isolated one-workout muscle dashboard", "dashboard-muscle-activity");

  const before = await muscleChartSnapshot(page, baseUrl, fixtureId, "chest", 7);
  assert.equal(before.completedSessions, 1, "The only completed workout should count in the selected period");
  assert.ok(before.workingSets > 0, "The only completed workout should add working sets");
  assert.notEqual(before.selected.intensity, "none", "The chest map should record the isolated workout");
  assert.ok(await page.evaluate(
    'document.querySelectorAll(\'[data-testid^="row-muscle-contributor-"]\').length > 0',
  ), "The selected muscle should list an exercise from the isolated workout");

  const correctedDate = new Date(Date.parse(`${session.date}T12:00:00.000Z`) - 8 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10);
  await navigate(page, `${baseUrl}/clients/${fixtureId}?tab=history`, "button-client-start-session");
  const historyOpened = await page.evaluate(`(() => {
    const edit = document.querySelector('[data-testid="button-edit-session-${sessionId}"]');
    const details = edit?.closest("details");
    details?.querySelector("summary")?.click();
    return !!details?.open;
  })()`);
  assert.equal(historyOpened, true, "Open the fixture workout in client history");
  await page.click(`button-edit-session-${sessionId}`);
  await waitFor("isolated saved workout editor", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') !== null',
  ));
  await page.fill("input-edit-session-date", correctedDate);
  await page.click("button-editor-save");
  await waitFor("isolated workout date correction", async () => {
    const client = (await storedState(page)).clients.find((item) => item.id === fixtureId);
    return client?.sessions.find((item) => item.id === sessionId)?.date;
  }, (date) => date === correctedDate);

  const after = await muscleChartSnapshot(page, baseUrl, fixtureId, "chest", 7);
  const afterDetails = await page.evaluate(`({
    selectedTotalSets: document.querySelector('[data-testid="text-selected-total-sets"]')?.textContent,
    selectedDirectIndirect: document.querySelector('[data-testid="text-selected-direct-indirect"]')?.textContent,
    selectedWeightedSets: document.querySelector('[data-testid="text-selected-weighted-sets"]')?.textContent,
    selectedWeeklyLoad: document.querySelector('[data-testid="text-selected-weekly-load"]')?.textContent,
    selectedLastSession: document.querySelector('[data-testid="text-selected-last-session"]')?.textContent,
    selectedFrequency: document.querySelector('[data-testid="text-selected-frequency"]')?.textContent,
    selectedRecoveryStatus: document.querySelector('[data-testid="status-muscle-recovery"]')?.textContent,
    contributorRows: document.querySelectorAll('[data-testid^="row-muscle-contributor-"]').length
  })`);
  assert.equal(after.workingSets, 0, "Moving the only recent workout out of the period should clear working sets");
  assert.equal(after.completedSessions, 0, "Moving the only recent workout out of the period should clear completed sessions");
  assert.ok(after.mapRegions.length > 0, "The muscle map should render its mapped regions");
  assert.ok(after.mapRegions.every((region) =>
    region.intensity === "none" && region.workload.includes("No recorded work"),
  ), "Every visible muscle region should show no recorded workload");
  assert.equal(after.selected.totalSets, "0", "The selected muscle should have zero working sets");
  assert.equal(after.selected.directIndirect, "0 / 0", "The selected muscle should have zero direct and indirect sets");
  assert.equal(after.selected.weightedSets, "0.00", "The selected muscle should have zero weighted sets");
  assert.equal(after.selected.weeklyLoad, "0.00", "The selected muscle should have zero weekly-equivalent workload");
  assert.equal(afterDetails.contributorRows, 0, "The selected muscle should have no contributor rows");
  assert.equal(after.selected.intensity, "none");
  assert.equal(afterDetails.selectedRecoveryStatus, "Recovered · estimate",
    "Recovery should still reflect the historical exposure after selected-period workload reaches zero");
  assert.ok(afterDetails.selectedLastSession.includes("8 days ago"),
    "Last-exposure history should remain visible outside the selected period");
  assert.match(afterDetails.selectedFrequency, /0 sessions \/ last 7 days0 in selected period/,
    "Selected-period frequency should reach zero without erasing last-exposure history");

  await page.click("button-muscle-view-back");
  const backMap = await page.evaluate(`Array.from(document.querySelectorAll('[data-testid^="region-muscle-"]'))
    .map((region) => ({
      intensity: region.getAttribute("data-intensity"),
      workload: region.getAttribute("aria-label")
    }))`);
  assert.ok(backMap.length > 0 && backMap.every((region) =>
    region.intensity === "none" && region.workload.includes("No recorded work"),
  ), "The back-view muscle map should also show no recorded workload");

  await reloadAndWait(page, "reloaded isolated muscle dashboard", "dashboard-muscle-activity");
  const persistedClient = (await storedState(page)).clients.find((item) => item.id === fixtureId);
  assert.deepEqual(persistedClient?.sessions, [{ ...session, date: correctedDate }],
    "Reload should preserve the historical workout with its corrected date rather than deleting it");
  assert.deepEqual(
    await muscleChartSnapshot(page, baseUrl, fixtureId, "chest", 7),
    after,
    "Zero selected-period workload, recovery, and last-exposure history should persist after reload",
  );
  assert.deepEqual(await page.evaluate(`({
    selectedTotalSets: document.querySelector('[data-testid="text-selected-total-sets"]')?.textContent,
    selectedDirectIndirect: document.querySelector('[data-testid="text-selected-direct-indirect"]')?.textContent,
    selectedWeightedSets: document.querySelector('[data-testid="text-selected-weighted-sets"]')?.textContent,
    selectedWeeklyLoad: document.querySelector('[data-testid="text-selected-weekly-load"]')?.textContent,
    selectedLastSession: document.querySelector('[data-testid="text-selected-last-session"]')?.textContent,
    selectedFrequency: document.querySelector('[data-testid="text-selected-frequency"]')?.textContent,
    selectedRecoveryStatus: document.querySelector('[data-testid="status-muscle-recovery"]')?.textContent,
    contributorRows: document.querySelectorAll('[data-testid^="row-muscle-contributor-"]').length
  })`), afterDetails, "Selected muscle details, recovery, and last-exposure history should persist after reload");
}

async function openSavedSessionEditor(page, baseUrl, sessionId, ownerId = "seed-amina") {
  await navigate(page, `${baseUrl}/clients/${ownerId}?tab=history`, "button-client-start-session");
  const historyOpened = await page.evaluate(`(() => {
    const edit = document.querySelector('[data-testid="button-edit-session-${sessionId}"]');
    const details = edit?.closest("details");
    if (!details?.open) details?.querySelector("summary")?.click();
    return !!details?.open;
  })()`);
  assert.equal(historyOpened, true, "Open the completed session from Amina's workout history");
  await page.click(`button-edit-session-${sessionId}`);
  await waitFor("saved workout editor", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') !== null',
  ));
}

async function rejectImpossibleSavedWorkoutDateAndVerifyUnchanged(page, baseUrl) {
  const beforeState = await storedState(page);
  const client = beforeState.clients.find((item) => item.id === "seed-amina");
  const session = client?.sessions.at(-1);
  assert.ok(session, "Amina should have a completed workout available to edit");
  const expectedClients = structuredClone(beforeState.clients);
  const expectedSession = expectedClients.find((item) => item.id === client.id)
    .sessions.find((item) => item.id === session.id);
  const validDate = new Date(Date.parse(`${session.date}T12:00:00.000Z`) - 86_400_000)
    .toISOString().slice(0, 10);

  await openSavedSessionEditor(page, baseUrl, session.id);
  await page.fillControlledValue("input-edit-session-date", "2026-02-30");
  await page.click("button-editor-save");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="text-editor-error"]\')?.textContent',
  ), "Enter a valid date.", "February 30 should be rejected instead of normalized");
  assert.notEqual(await page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') !== null',
  ), false, "The editor should remain open after rejecting an impossible date");
  assert.deepEqual((await storedState(page)).clients, beforeState.clients,
    "Rejecting an impossible date must leave the session and all workout data unchanged");

  expectedSession.date = validDate;
  await page.fill("input-edit-session-date", validDate);
  await page.click("button-editor-save");
  await waitFor("valid saved-workout date correction", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "A valid date should save while preserving all other client and workout data");

  await reloadAndWait(page, "reloaded valid saved-workout date correction", "button-client-start-session");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "The valid date and unchanged workout data should persist after reload");
}

async function addSavedSetAndVerifyCharts(page, baseUrl, sourceClients) {
  const fixture = structuredClone(sourceClients.find((client) => client.id === "seed-amina"));
  assert.ok(fixture, "The saved-set fixture should have a source client");
  fixture.id = "test-added-saved-set";
  fixture.name = "Added saved set fixture";
  fixture.sessions = [fixture.sessions[0]];
  const session = fixture.sessions[0];
  session.id = `${fixture.id}-session`;
  session.date = todayIso();
  const bench = session.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.ok(bench, "The isolated saved workout should contain a mapped bench press");
  session.exercises = [bench];

  await page.evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem("setstack-v1"));
    data.state.clients = data.state.clients.filter((client) => client.id !== ${JSON.stringify(fixture.id)});
    data.state.clients.push(${JSON.stringify(fixture)});
    localStorage.setItem("setstack-v1", JSON.stringify(data));
  })()`);
  const fixtureMuscleUrl = `${baseUrl}/clients/${fixture.id}?tab=muscles&period=7`;
  await page.evaluate(`history.replaceState(null, "", ${JSON.stringify(fixtureMuscleUrl)})`);
  await reloadAndWait(page, "isolated add-set fixture", "dashboard-muscle-activity");

  const beforeState = await storedState(page);
  const savedFixture = beforeState.clients.find((client) => client.id === fixture.id);
  const savedSession = savedFixture?.sessions.find((item) => item.id === session.id);
  const savedBench = savedSession?.exercises.find((exercise) => exercise.id === bench.id);
  assert.ok(savedSession && savedBench, "The isolated saved workout should be available for editing");
  assert.equal(savedBench.sets.length, 2, "The fixture bench press should begin with two sets");
  const expectedClients = structuredClone(beforeState.clients);
  const expectedFixture = expectedClients.find((client) => client.id === fixture.id);
  const expectedSession = expectedFixture.sessions.find((item) => item.id === session.id);
  const expectedBench = expectedSession.exercises.find((exercise) => exercise.id === bench.id);
  const clientSnapshot = async (ownerId) => ({
    chest: await muscleChartSnapshot(page, baseUrl, ownerId, "chest"),
    triceps: await muscleChartSnapshot(page, baseUrl, ownerId, "triceps"),
  });
  const before = await clientSnapshot(fixture.id);
  const otherBefore = await clientSnapshot("seed-leo");
  const expectedWeightKg = 42.5;
  const expectedReps = 6;
  const expectedRir = 2;

  await openSavedSessionEditor(page, baseUrl, session.id, fixture.id);
  await page.click(`button-editor-add-set-${bench.id}`);
  await waitFor("new saved-workout set row", () => page.evaluate(
    `document.querySelectorAll('[data-testid^="editor-exercise-${bench.id}"] [data-testid^="editor-set-"]').length`,
  ), (count) => count === savedBench.sets.length + 1);
  const newSetId = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    const rows = [...(section?.querySelectorAll('[data-testid^="editor-set-"]') ?? [])];
    return rows.at(-1)?.getAttribute("data-testid")?.replace("editor-set-", "");
  })()`);
  assert.ok(newSetId, "The newly added set should have a stable editor row");
  const unit = beforeState.unit;
  const displayWeight = String(Number(toDisplay(expectedWeightKg, unit).toFixed(2)));
  await page.fill(`input-editor-weight-${newSetId}`, displayWeight);
  await page.fill(`input-editor-reps-${newSetId}`, String(expectedReps));
  await page.fill(`input-editor-rir-${newSetId}`, String(expectedRir));
  await page.click("button-editor-save");
  await waitFor("new saved-workout set persisted", async () => {
    const client = (await storedState(page)).clients.find((item) => item.id === fixture.id);
    return client?.sessions.find((item) => item.id === session.id)
      ?.exercises.find((exercise) => exercise.id === bench.id)?.sets.length;
  }, (count) => count === savedBench.sets.length + 1);

  const afterState = await storedState(page);
  const addedSet = afterState.clients.find((client) => client.id === fixture.id)
    ?.sessions.find((item) => item.id === session.id)
    ?.exercises.find((exercise) => exercise.id === bench.id)?.sets.at(-1);
  assert.ok(addedSet?.id && !savedBench.sets.some((set) => set.id === addedSet.id),
    "The added set should be stored with a new ID");
  const expectedAddedSet = {
    id: addedSet.id,
    weight: expectedWeightKg,
    reps: expectedReps,
    rpe: 10 - expectedRir,
    kind: "normal",
  };
  assert.deepEqual(addedSet, expectedAddedSet,
    "The added set must be stored with its exact load, reps, effort, type, and editor ID");
  expectedBench.sets.push(expectedAddedSet);
  assert.deepEqual(afterState.clients, expectedClients,
    "Saving the added set must change only the isolated fixture session");

  const after = await clientSnapshot(fixture.id);
  for (const [muscle, directDelta, indirectDelta, weightedDelta] of [
    ["chest", 1, 0, 1],
    ["triceps", 0, 1, 0.5],
  ]) {
    const initial = before[muscle];
    const actual = after[muscle];
    assert.equal(actual.workingSets, initial.workingSets + 1,
      `${muscle}: the new normal set should add one working set`);
    assert.equal(actual.completedSessions, initial.completedSessions,
      `${muscle}: adding a set must not create another completed session`);
    const [initialDirect, initialIndirect] = initial.selected.directIndirect.split(" / ").map(Number);
    assert.equal(actual.selected.directIndirect,
      `${initialDirect + directDelta} / ${initialIndirect + indirectDelta}`,
      `${muscle}: direct and indirect set counts should reflect the new contribution`);
    assert.equal(Number(actual.selected.totalSets),
      Number(initial.selected.totalSets) + directDelta + indirectDelta,
      `${muscle}: involved-set count should reflect the new contribution`);
    assert.equal(actual.selected.weightedSets,
      (Number(initial.selected.weightedSets) + weightedDelta).toFixed(2),
      `${muscle}: weighted workload should reflect the new set's effort factor`);
    assert.equal(actual.selected.weeklyLoad,
      (Number(initial.selected.weeklyLoad) + weightedDelta).toFixed(2),
      `${muscle}: weekly-equivalent workload should reflect the selected period`);
  }
  assert.deepEqual(await clientSnapshot("seed-leo"), otherBefore,
    "Adding a set to one client's workout must not change another client's charts");

  await reloadAndWait(page, "reloaded added-set muscle dashboard", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "The new set and only its fixture workout must persist after reload");
  assert.deepEqual(await clientSnapshot(fixture.id), after,
    "The 7-day direct and indirect muscle totals must persist after reload");
  assert.deepEqual(await clientSnapshot("seed-leo"), otherBefore,
    "Another client's charts must remain unchanged after reload");
}

async function cancelSavedSetCorrectionAndVerifyUnchanged(page, baseUrl) {
  const beforeState = await storedState(page);
  const amina = beforeState.clients.find((client) => client.id === "seed-amina");
  const session = amina?.sessions.find((item) => item.id === "seed-amina-1");
  const bench = session?.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.ok(session, "Amina's saved workout should be available to edit");
  assert.ok(bench, "The saved workout should contain a bench press");
  assert.equal(bench.sets.length, 2, "The bench press should start with two saved sets");

  const snapshot = async () => ({
    amina: {
      chest: await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest"),
      triceps: await muscleChartSnapshot(page, baseUrl, "seed-amina", "triceps"),
      quadriceps: await muscleChartSnapshot(page, baseUrl, "seed-amina", "quadriceps"),
      chest30: await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30),
    },
    leoChest: await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest"),
  });
  const beforeCharts = await snapshot();
  const expectedWeight = String(Number(toDisplay(bench.sets[0].weight + 5, beforeState.unit).toFixed(2)));

  await openSavedSessionEditor(page, baseUrl, session.id);
  const expanded = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    const toggle = section?.querySelector("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    return !!toggle;
  })()`);
  assert.equal(expanded, true, "Expand the saved bench press sets");
  await page.fill(`input-editor-weight-${bench.sets[0].id}`, expectedWeight);
  await page.click(`button-editor-remove-set-${bench.sets[1].id}`);
  assert.equal(
    await page.evaluate(`document.querySelectorAll('[data-testid^="editor-set-"]').length`),
    1,
    "The unsaved edit should change one set and remove the other",
  );
  assert.deepEqual((await storedState(page)).clients, beforeState.clients,
    "Changing and removing sets in the open editor must not alter stored client history");

  await page.click("button-editor-cancel");
  await waitFor("cancelled saved workout editor to close", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  assert.deepEqual((await storedState(page)).clients, beforeState.clients,
    "Cancelling the set correction must leave every stored client record unchanged");
  assert.deepEqual(await snapshot(), beforeCharts,
    "Cancelling the set correction must leave the muscle charts unchanged");

  await reloadAndWait(page, "reloaded cancelled workout correction", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, beforeState.clients,
    "Client records and workout history must remain unchanged after reload");
  assert.deepEqual(await snapshot(), beforeCharts,
    "Muscle chart snapshots must remain unchanged after reload");

  await openSavedSessionEditor(page, baseUrl, session.id);
  const reopenedExpanded = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    const toggle = section?.querySelector("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    return !!toggle;
  })()`);
  assert.equal(reopenedExpanded, true, "Expand the saved bench press sets again");
  await waitFor("original bench sets rendered in reopened editor", () => page.evaluate(
    `document.querySelectorAll('[data-testid="editor-exercise-${bench.id}"] [data-testid^="editor-set-"]').length`,
  ), (count) => count === bench.sets.length);
  const reopened = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    return {
      count: section?.querySelectorAll('[data-testid^="editor-set-"]').length,
      sets: ${JSON.stringify(bench.sets.map((set) => ({
        id: set.id,
        weight: String(Number(toDisplay(set.weight, beforeState.unit).toFixed(2))),
        reps: String(set.reps),
        rir: set.rpe == null ? "" : String(10 - set.rpe),
        kind: set.kind,
      })))}.map((set) => ({
        ...set,
        weight: section?.querySelector('[data-testid="input-editor-weight-' + set.id + '"]')?.value,
        reps: section?.querySelector('[data-testid="input-editor-reps-' + set.id + '"]')?.value,
        rir: section?.querySelector('[data-testid="input-editor-rir-' + set.id + '"]')?.value,
        kind: section?.querySelector('[data-testid="select-editor-kind-' + set.id + '"]')?.value,
      })),
    };
  })()`);
  assert.equal(reopened.count, bench.sets.length, "Reopening the editor must show both original bench sets");
  assert.deepEqual(reopened.sets, bench.sets.map((set) => ({
    id: set.id,
    weight: String(Number(toDisplay(set.weight, beforeState.unit).toFixed(2))),
    reps: String(set.reps),
    rir: set.rpe == null ? "" : String(10 - set.rpe),
    kind: set.kind,
  })), "Reopening the editor must show the original load, reps, effort, and set type");
  await page.click("button-editor-cancel");
}

async function rejectEmptySavedWorkoutAndVerifyUnchanged(page, baseUrl) {
  const beforeState = await storedState(page);
  const amina = beforeState.clients.find((client) => client.id === "seed-amina");
  const session = amina?.sessions.find((item) => item.id === "seed-amina-1");
  assert.ok(session, "Amina's saved workout should be available to edit");
  const allSets = session.exercises.flatMap((exercise) => exercise.sets.map((set) => set.id));
  assert.ok(allSets.length > 0, "The saved workout should start with sets to remove");

  const snapshot = async () => ({
    amina: {
      chest: await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest"),
      triceps: await muscleChartSnapshot(page, baseUrl, "seed-amina", "triceps"),
      quadriceps: await muscleChartSnapshot(page, baseUrl, "seed-amina", "quadriceps"),
      chest30: await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30),
    },
    leoChest: await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest"),
  });
  const beforeCharts = await snapshot();

  await openSavedSessionEditor(page, baseUrl, session.id);
  await page.fill("input-edit-session-name", "This edit must not be saved");
  const changedDate = session.date === "2020-01-01" ? "2020-01-02" : "2020-01-01";
  await page.fill("input-edit-session-date", changedDate);

  for (const exercise of session.exercises) {
    const expanded = await page.evaluate(`(() => {
      const section = document.querySelector('[data-testid="editor-exercise-${exercise.id}"]');
      const toggle = section?.querySelector("button[aria-expanded]");
      if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
      return !!toggle;
    })()`);
    assert.equal(expanded, true, `Expand ${exercise.name} sets`);
    for (const set of exercise.sets) {
      await page.click(`button-editor-remove-set-${set.id}`);
    }
  }

  assert.equal(
    await page.evaluate('document.querySelectorAll(\'[data-testid^="editor-set-"]\').length'),
    0,
    "Every saved set should be removed from the unsaved editor",
  );
  await page.click("button-editor-save");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="text-editor-error"]\')?.textContent',
  ), "A workout needs at least one set. Use Cancel and delete the session instead.",
  "Saving a workout with no remaining sets should show the validation message");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') !== null',
  ), true, "The editor should stay open after rejecting the empty workout");
  assert.deepEqual((await storedState(page)).clients, beforeState.clients,
    "A rejected empty-workout save must not persist the edited name, date, or sets");

  await page.click("button-editor-cancel");
  await waitFor("cancelled empty saved workout editor to close", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  assert.deepEqual((await storedState(page)).clients, beforeState.clients,
    "Cancelling after the rejected save must leave every stored client record unchanged");
  assert.deepEqual(await snapshot(), beforeCharts,
    "Rejecting and cancelling the empty-workout edit must leave all checked muscle charts unchanged");

  await reloadAndWait(page, "reloaded cancelled empty workout edit", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, beforeState.clients,
    "Workout history and client records must remain unchanged after reload");
  assert.deepEqual(await snapshot(), beforeCharts,
    "Muscle chart snapshots must remain unchanged after reload");
}

async function correctSavedSetsAndVerifyCharts(page, baseUrl) {
  const beforeState = await storedState(page);
  const amina = beforeState.clients.find((client) => client.id === "seed-amina");
  // Leave the newest seed workout intact for the separate date-correction case.
  const session = amina.sessions.find((item) => item.id === "seed-amina-1");
  const bench = session.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.ok(bench, "The saved workout must contain a bench press with known muscle contributions");
  assert.equal(bench.sets.length, 2);
  for (const set of bench.sets) {
    assert.equal(set.kind, "normal");
    assert.equal(set.rpe, 8, "Each fixture set contributes 1 direct or 0.5 indirect weighted sets");
    assert.ok(set.reps > 0);
  }

  const snapshot = async (id) => ({
    chest: await muscleChartSnapshot(page, baseUrl, id, "chest"),
    triceps: await muscleChartSnapshot(page, baseUrl, id, "triceps"),
    quadriceps: await muscleChartSnapshot(page, baseUrl, id, "quadriceps"),
  });
  const before = await snapshot("seed-amina");
  const leoBefore = await snapshot("seed-leo");
  const expectedSession = structuredClone(session);
  const expectedBench = expectedSession.exercises.find((exercise) => exercise.id === bench.id);

  // Check each save independently: deleting a working set, then excluding the
  // remaining set as a warm-up must each remove exactly one contribution.
  for (const correction of ["remove", "warmup"]) {
    await openSavedSessionEditor(page, baseUrl, session.id);
    const expanded = await page.evaluate(`(() => {
      const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
      const toggle = section?.querySelector("button[aria-expanded]");
      if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
      return !!toggle;
    })()`);
    assert.equal(expanded, true, "Expand the saved bench press sets");
    if (correction === "remove") {
      await page.click(`button-editor-remove-set-${bench.sets[0].id}`);
      expectedBench.sets.shift();
    } else {
      await page.fill(`select-editor-kind-${bench.sets[1].id}`, "warmup");
      expectedBench.sets[0].kind = "warmup";
    }
    await page.click("button-editor-save");
    await waitFor(`${correction} correction saved and editor closed`, () => page.evaluate(
      'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
    ));
    const saved = await storedState(page);
    const expectedClients = structuredClone(beforeState.clients);
    const expectedAmina = expectedClients.find((client) => client.id === "seed-amina");
    expectedAmina.sessions = expectedAmina.sessions.map((item) => item.id === session.id ? expectedSession : item);
    assert.deepEqual(saved.clients, expectedClients, "Only the intended set correction should be persisted");

    const removed = correction === "remove" ? 1 : 2;
    const after = await snapshot("seed-amina");
    for (const [muscle, direct, indirect, weighted] of [
      ["chest", removed, 0, removed],
      ["triceps", 0, removed, removed * 0.5],
      ["quadriceps", 0, 0, 0],
    ]) {
      const initial = before[muscle];
      const actual = after[muscle];
      assert.equal(actual.workingSets, initial.workingSets - removed, `${muscle}: overall working sets after ${correction}`);
      assert.equal(actual.completedSessions, initial.completedSessions, "The session still has other working exercises");
      const [initialDirect, initialIndirect] = initial.selected.directIndirect.split(" / ").map(Number);
      assert.equal(actual.selected.directIndirect, `${initialDirect - direct} / ${initialIndirect - indirect}`,
        `${muscle}: exact direct / indirect sets after ${correction}`);
      assert.equal(Number(actual.selected.totalSets), Number(initial.selected.totalSets) - direct - indirect,
        `${muscle}: exact involved sets after ${correction}`);
      assert.equal(actual.selected.weightedSets, (Number(initial.selected.weightedSets) - weighted).toFixed(2),
        `${muscle}: exact weighted sets after ${correction}`);
      assert.equal(actual.selected.weeklyLoad, (Number(initial.selected.weeklyLoad) - weighted).toFixed(2),
        `${muscle}: exact 7-day weekly-equivalent load after ${correction}`);
    }
    assert.deepEqual(after.quadriceps.selected, before.quadriceps.selected, "An unrelated muscle must not change");
    assert.deepEqual(await snapshot("seed-leo"), leoBefore, "Another client's chart must not change");

    await reloadAndWait(page, "reloaded set correction dashboard", "dashboard-muscle-activity");
    assert.deepEqual((await storedState(page)).clients, expectedClients, "The exact set correction must survive reload");
    assert.deepEqual(await snapshot("seed-amina"), after, "Corrected muscle totals must survive reload");
    assert.deepEqual(await snapshot("seed-leo"), leoBefore, "Another client's chart must stay unchanged after reload");
  }
}

async function correctSavedEffortAndVerifyCharts(page, baseUrl) {
  const beforeState = await storedState(page);
  const amina = beforeState.clients.find((client) => client.id === "seed-amina");
  const session = amina?.sessions.find((item) => item.id === "seed-amina-2");
  const bench = session?.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.ok(session, "Amina's completed effort-correction workout should exist");
  assert.ok(bench, "The completed workout should contain a mapped bench press");
  assert.equal(bench.sets.length, 2);
  assert.ok(bench.sets.every((set) => set.kind === "normal" && set.rpe === 8),
    "Both bench sets should start at RIR 2, the ×1.0 effort factor");

  const snapshot = async (id, period = 30) => ({
    chest: await muscleChartSnapshot(page, baseUrl, id, "chest", period),
    triceps: await muscleChartSnapshot(page, baseUrl, id, "triceps", period),
  });
  const snapshotBothPeriods = async (id) => ({
    7: await snapshot(id, 7),
    30: await snapshot(id, 30),
  });
  const before = await snapshot("seed-amina");
  const leoBefore = await snapshot("seed-leo");
  const originalBenchSets = structuredClone(bench.sets);
  const expectedClients = structuredClone(beforeState.clients);
  const expectedSession = expectedClients.find((client) => client.id === "seed-amina")
    .sessions.find((item) => item.id === session.id);
  const expectedBench = expectedSession.exercises.find((exercise) => exercise.id === bench.id);

  // These changes cross both effort-factor boundaries (RIR 1/2 and 3/4).
  // Each save changes only one RIR; the adjacent sets remain untouched.
  for (const correction of [
    { setIndex: 0, rir: 1 },
    { setIndex: 1, rir: 4 },
    { setIndex: 1, rir: 3 },
  ]) {
    const originalRpe = originalBenchSets[correction.setIndex].rpe;
    expectedBench.sets[correction.setIndex].rpe = 10 - correction.rir;
    const directDelta = expectedBench.sets.reduce((sum, set, index) =>
      sum + effortFactorFromRpe(set.rpe) - effortFactorFromRpe(originalBenchSets[index].rpe), 0,
    );
    const secondaryDelta = directDelta * 0.5;

    await openSavedSessionEditor(page, baseUrl, session.id);
    const expanded = await page.evaluate(`(() => {
      const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
      const toggle = section?.querySelector("button[aria-expanded]");
      if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
      return !!toggle;
    })()`);
    assert.equal(expanded, true, "Expand the bench press RIR inputs");
    await page.fill(
      `input-editor-rir-${bench.sets[correction.setIndex].id}`,
      correction.rir,
    );
    await page.click("button-editor-save");
    await waitFor("saved RIR correction and closed editor", () => page.evaluate(
      'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
    ));
    assert.deepEqual((await storedState(page)).clients, expectedClients,
      "An effort correction must change only the selected set's RPE (saved from RIR)");

    const after = await snapshot("seed-amina");
    for (const [muscle, delta] of [["chest", directDelta], ["triceps", secondaryDelta]]) {
      const initial = before[muscle];
      const actual = after[muscle];
      assert.equal(actual.workingSets, initial.workingSets,
        `${muscle}: overall working-set count must not change after editing RIR`);
      assert.equal(actual.completedSessions, initial.completedSessions,
        `${muscle}: completed-session count must not change after editing RIR`);
      assert.equal(actual.selected.totalSets, initial.selected.totalSets,
        `${muscle}: involved-set count must not change after editing RIR`);
      assert.equal(actual.selected.directIndirect, initial.selected.directIndirect,
        `${muscle}: direct and indirect set counts must not change after editing RIR`);
      assert.equal(actual.selected.weightedSets,
        (Number(initial.selected.weightedSets) + delta).toFixed(2),
        `${muscle}: weighted sets must follow the exact effort factor`);
      assert.equal(actual.selected.weeklyLoad,
        (Number(initial.selected.weeklyLoad) + delta * 7 / 30).toFixed(2),
        `${muscle}: 30-day weekly-equivalent load must follow the exact effort factor`);

      const initialContribution = parseContributorDetails(
        initial.selected.contributors.find((item) => item.exerciseId === bench.id),
      );
      const actualContribution = parseContributorDetails(
        actual.selected.contributors.find((item) => item.exerciseId === bench.id),
      );
      assert.equal(actualContribution.directSets, initialContribution.directSets,
        `${muscle}: contributor direct-set count must not change after editing RIR`);
      assert.equal(actualContribution.indirectSets, initialContribution.indirectSets,
        `${muscle}: contributor indirect-set count must not change after editing RIR`);
      assert.ok(Math.abs(actualContribution.weightedSets -
        (initialContribution.weightedSets + delta)) < 0.011,
      `${muscle}: the bench press contributor's displayed weighted amount must follow the edited effort`);
    }
    assert.deepEqual(await snapshot("seed-leo"), leoBefore,
      "Correcting Amina's effort must not change another client's charts");

    await reloadAndWait(page, "reloaded RIR correction dashboard", "dashboard-muscle-activity");
    assert.deepEqual((await storedState(page)).clients, expectedClients,
      "The RIR-only correction must persist after reload without changing other session fields");
    assert.deepEqual(await snapshot("seed-amina"), after,
      "Direct and secondary weighted totals must persist after reload");
    assert.deepEqual(await snapshot("seed-leo"), leoBefore,
      "Another client's charts must remain unchanged after reload");

    // Keep the next action's reference explicit: only the edited set may differ
    // from its original RPE, including when the same set crosses back over a boundary.
    assert.equal(expectedBench.sets[correction.setIndex].rpe, 10 - correction.rir);
    assert.notEqual(expectedBench.sets[correction.setIndex].rpe, originalRpe,
      "Each step must actually cross to a different effort factor");
  }

  const sessionAgeDays = Math.floor(
    (Date.parse(`${todayIso()}T00:00:00Z`) - Date.parse(`${session.date}T00:00:00Z`)) / 86_400_000,
  );
  assert.ok(sessionAgeDays >= 0 && sessionAgeDays < 7,
    "The effort-correction workout must fall inside both chart periods");
  const beforeClear = await snapshotBothPeriods("seed-amina");
  const leoBeforeClear = await snapshot("seed-leo");
  const clearedSetIndex = 0;
  const clearedSet = expectedBench.sets[clearedSetIndex];
  const previousFactor = effortFactorFromRpe(clearedSet.rpe);
  assert.equal(effortFactorFromRpe(null), 1,
    "A cleared saved effort value must use the neutral ×1.0 factor");
  clearedSet.rpe = null;

  await openSavedSessionEditor(page, baseUrl, session.id);
  const expanded = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    const toggle = section?.querySelector("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    return !!toggle;
  })()`);
  assert.equal(expanded, true, "Expand the bench press RIR inputs to clear one saved value");
  await page.fill(`input-editor-rir-${clearedSet.id}`, "");
  await page.click("button-editor-save");
  await waitFor("cleared RIR correction and closed editor", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));

  const clearedState = await storedState(page);
  assert.deepEqual(clearedState.clients, expectedClients,
    "Clearing RIR must save null and leave all other workout and client data unchanged");
  assert.equal(
    clearedState.clients.find((client) => client.id === "seed-amina")
      ?.sessions.find((item) => item.id === session.id)
      ?.exercises.find((exercise) => exercise.id === bench.id)
      ?.sets.find((set) => set.id === clearedSet.id)?.rpe,
    null,
    "The cleared saved effort must be stored as null",
  );

  const afterClear = await snapshotBothPeriods("seed-amina");
  const directDelta = effortFactorFromRpe(null) - previousFactor;
  const secondaryDelta = directDelta * 0.5;
  for (const period of [7, 30]) {
    for (const [muscle, delta] of [["chest", directDelta], ["triceps", secondaryDelta]]) {
      const initial = beforeClear[period][muscle];
      const actual = afterClear[period][muscle];
      assert.equal(actual.workingSets, initial.workingSets,
        `${period}-day ${muscle}: clearing RIR must not change overall working-set count`);
      assert.equal(actual.completedSessions, initial.completedSessions,
        `${period}-day ${muscle}: clearing RIR must not change completed-session count`);
      assert.equal(actual.selected.totalSets, initial.selected.totalSets,
        `${period}-day ${muscle}: clearing RIR must not change involved-set count`);
      assert.equal(actual.selected.directIndirect, initial.selected.directIndirect,
        `${period}-day ${muscle}: clearing RIR must not change direct or indirect set counts`);
      assert.ok(Math.abs(Number(actual.selected.weightedSets) -
        (Number(initial.selected.weightedSets) + delta)) < 0.011,
      `${period}-day ${muscle}: direct or secondary weighted totals must use the neutral ×1.0 factor`);
      assert.ok(Math.abs(Number(actual.selected.weeklyLoad) -
        (Number(initial.selected.weeklyLoad) + delta * 7 / period)) < 0.011,
      `${period}-day ${muscle}: weekly-equivalent workload must reflect the neutral ×1.0 factor`);
    }
  }
  assert.deepEqual(await snapshot("seed-leo"), leoBeforeClear,
    "Clearing Amina's RIR must not change another client's charts");

  await reloadAndWait(page, "reloaded cleared RIR dashboard", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "The null effort value must persist after reload");
  assert.deepEqual(await snapshotBothPeriods("seed-amina"), afterClear,
    "Direct and secondary neutral-weighted totals in both chart periods must persist after reload");
  assert.deepEqual(await snapshot("seed-leo"), leoBeforeClear,
    "Another client's charts must remain unchanged after reload");
}

async function rejectInvalidSavedEffortAndVerifyUnchanged(page, baseUrl) {
  const beforeState = await storedState(page);
  const session = beforeState.clients.find((client) => client.id === "seed-amina")
    ?.sessions.find((item) => item.id === "seed-amina-2");
  const bench = session?.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.ok(session, "Amina's completed effort-correction workout should exist");
  assert.ok(bench, "The completed workout should contain a bench press");
  const rirInputId = `input-editor-rir-${bench.sets[0].id}`;
  const rawBefore = await page.evaluate('localStorage.getItem("setstack-v1")');
  const sessionBefore = JSON.stringify(session);

  const snapshot = async (id) => ({
    chest: await muscleChartSnapshot(page, baseUrl, id, "chest", 30),
    triceps: await muscleChartSnapshot(page, baseUrl, id, "triceps", 30),
  });
  const beforeCharts = await snapshot("seed-amina");

  await openSavedSessionEditor(page, baseUrl, session.id);
  const expanded = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    const toggle = section?.querySelector("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    return !!toggle;
  })()`);
  assert.equal(expanded, true, "Expand the bench press RIR input");
  for (const rir of ["-1", "11", "Infinity", "NaN"]) {
    if (Number.isFinite(Number(rir))) await page.fill(rirInputId, rir);
    else await page.fillControlledValue(rirInputId, rir);
    await page.click("button-editor-save");
    const validation = await waitFor(`visible validation for RIR ${rir}`, () => page.evaluate(`(() => {
      const error = document.querySelector('[data-testid="text-editor-error"]');
      return error && { text: error.textContent, visible: error.getClientRects().length > 0 };
    })()`), (value) => value?.visible === true);
    assert.equal(validation.text,
      "Barbell Bench Press, set 1: check load, whole reps and RIR (0 to 10).",
      `RIR ${rir} should be rejected with the editor validation message`);
    assert.equal(await page.evaluate('localStorage.getItem("setstack-v1")'), rawBefore,
      `Rejecting RIR ${rir} must leave the persisted storage byte-for-byte unchanged`);
    const stateAfterAttempt = await storedState(page);
    const sessionAfterAttempt = stateAfterAttempt.clients.find((client) => client.id === "seed-amina")
      ?.sessions.find((item) => item.id === session.id);
    assert.equal(JSON.stringify(sessionAfterAttempt), sessionBefore,
      `Rejecting RIR ${rir} must leave the saved session byte-for-byte equivalent`);
  }

  await page.click("button-editor-cancel");
  await waitFor("invalid workout editor closed", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  await navigate(page, `${baseUrl}/clients/seed-amina?tab=muscles&period=30`, "dashboard-muscle-activity");
  await reloadAndWait(page, "reloaded after rejected RIR corrections", "dashboard-muscle-activity");
  assert.equal(await page.evaluate('localStorage.getItem("setstack-v1")'), rawBefore,
    "Reloading after invalid RIR corrections must preserve the exact saved storage");
  assert.deepEqual(await storedState(page), beforeState,
    "Reloading after invalid RIR corrections must preserve every saved client record");
  assert.deepEqual(await snapshot("seed-amina"), beforeCharts,
    "Rejected RIR corrections must not change direct/secondary workload or set counts after reload");
}

async function switchWorkoutUnitAndReload(page, baseUrl, unit) {
  await navigate(page, `${baseUrl}/settings`, `button-unit-${unit}`);
  await page.click(`button-unit-${unit}`);
  await waitFor(`saved ${unit} display unit`, async () => (await storedState(page)).unit, (value) => value === unit);

  await navigate(page, `${baseUrl}/clients/${clientId}`, "panel-workout-logger");
  await waitFor("resumed workout logger", () => page.evaluate(
    'document.querySelector(\'[data-testid="panel-workout-logger"]\') !== null',
  ));
  const expectedWeightText = unit === "kg"
    ? "60.625"
    : String(Number(toDisplay(60.625, unit).toFixed(2)));
  const exerciseId = (await storedState(page)).draft.exercises[0].id;
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="input-set-weight"]\')?.value',
  ), expectedWeightText, `Pending load should display correctly in ${unit}`);
  assert.equal((await storedState(page)).draft.entries[exerciseId]?.weightKg, 60.625);

  await page.fill("input-set-reps", "6");
  assert.equal((await storedState(page)).draft.entries[exerciseId]?.weightKg, 60.625,
    "Changing only reps must preserve the canonical pending load");
  await page.fill("input-set-rir", "0");
  assert.equal((await storedState(page)).draft.entries[exerciseId]?.weightKg, 60.625,
    "Changing only RIR must preserve the canonical pending load");

  await reloadAndWait(page, "reloaded workout logger", "panel-workout-logger");
  const reloaded = await storedState(page);
  assert.equal(reloaded.unit, unit);
  assert.equal(reloaded.draft.exercises[0]?.sets[0]?.weight, 52.5,
    "The previously logged load must remain exact after changing units and reloading");
  assert.equal(reloaded.draft.entries[exerciseId]?.weightKg, 60.625,
    "The pending canonical load must remain exact after changing units and reloading");
  assert.equal(reloaded.draft.entries[exerciseId]?.reps, 6);
  assert.equal(reloaded.draft.entries[exerciseId]?.rir, 0);
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="input-set-weight"]\')?.value',
  ), expectedWeightText);
  const expectedLoggedLoad = `${String(Number(toDisplay(52.5, unit).toFixed(1)))} ${unit}`;
  assert.ok(await page.evaluate(
    `document.querySelector('[data-testid="list-current-sets"]')?.textContent.includes(${JSON.stringify(expectedLoggedLoad)})`,
  ), "The logged set should remain visible in the selected unit after reloading");
}

async function correctSavedSessionAndVerifyCharts(page, baseUrl) {
  const aminaBeforeCorrection = await muscleChartSnapshot(page, baseUrl, "seed-amina");
  const leoBeforeCorrection = await muscleChartSnapshot(page, baseUrl, "seed-leo");
  const amina30BeforeCorrection = await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30);
  const leo30BeforeCorrection = await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest", 30);
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
    aminaAfterCorrection.selected.workload,
    aminaBeforeCorrection.selected.workload,
    "The chest region on the muscle map should reflect the corrected workout date",
  );
  assert.notEqual(
    aminaAfterCorrection.selected.directIndirect,
    aminaBeforeCorrection.selected.directIndirect,
    "The selected muscle totals should update after the correction",
  );

  assert.deepEqual(
    await muscleChartSnapshot(page, baseUrl, "seed-leo"),
    leoBeforeCorrection,
    "Correcting Amina's workout must not change Leo's muscle chart",
  );

  await reloadAndWait(page, "reloaded client muscle dashboard", "dashboard-muscle-activity");
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

  assert.deepEqual(
    await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30),
    amina30BeforeCorrection,
    "Moving a workout outside seven days but within thirty must keep its 30-day contributions",
  );

  const bench = session.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.equal(bench?.sets.length, 2, "The date fixture has two direct chest working sets");
  for (const set of bench.sets) {
    assert.equal(set.kind, "normal");
    assert.ok(set.reps > 0);
    assert.equal(set.rpe, 8, "Each fixture chest set contributes exactly one weighted set");
  }
  const expectedClients = structuredClone(beforeState.clients);
  const expectedSession = expectedClients.find((client) => client.id === "seed-amina")
    .sessions.find((item) => item.id === session.id);
  const today = todayIso();
  const dateDaysAgo = (days) => new Date(Date.parse(`${today}T12:00:00Z`) - days * 86_400_000)
    .toISOString().slice(0, 10);
  const benchWeightedSets = bench.sets.reduce((total, set) => total + effortFactorFromRpe(set.rpe), 0);
  const assertExactRestoredTotals = (excluded, restored, baseline, period, description) => {
    assert.equal(restored.workingSets, excluded.workingSets + movedWorkingSets,
      `${description}: restore exactly this workout's working sets`);
    assert.equal(restored.completedSessions, excluded.completedSessions + 1,
      `${description}: restore exactly one completed session`);
    assert.deepEqual(restored, baseline,
      `${description}: restore the original totals and visible muscle-map workload without double counting`);
    const [direct, indirect] = excluded.selected.directIndirect.split(" / ").map(Number);
    const expectedWeighted = Number(excluded.selected.weightedSets) + benchWeightedSets;
    assert.equal(restored.selected.totalSets, String(Number(excluded.selected.totalSets) + bench.sets.length),
      `${description}: restore exactly the bench press's chest set count`);
    assert.equal(restored.selected.directIndirect, `${direct + bench.sets.length} / ${indirect}`,
      `${description}: restore exactly the bench press's direct chest sets`);
    assert.equal(restored.selected.weightedSets, expectedWeighted.toFixed(2),
      `${description}: restore the exact effort-weighted chest sets`);
    assert.equal(restored.selected.weeklyLoad, (expectedWeighted * 7 / period).toFixed(2),
      `${description}: restore the exact ${period}-day weekly-equivalent chest workload`);
  };
  let excluded30DayChart;

  // Thirty calendar days includes today and the preceding 29 days.
  // Save on both sides of that exact boundary through the real history editor.
  for (const daysAgo of [29, 30]) {
    expectedSession.date = dateDaysAgo(daysAgo);
    await openSavedSessionEditor(page, baseUrl, session.id);
    await page.fill("input-edit-session-date", expectedSession.date);
    await page.click("button-editor-save");
    await waitFor("30-day boundary correction saved and editor closed", () => page.evaluate(
      'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
    ));
    assert.deepEqual((await storedState(page)).clients, expectedClients,
      "Correcting the date must preserve every other session field and client");

    const after30 = await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30);
    if (daysAgo === 29) {
      assert.deepEqual(after30, amina30BeforeCorrection,
        "The oldest included day must retain all 30-day totals and muscle-map workload");
    } else {
      excluded30DayChart = after30;
      assert.equal(after30.workingSets, amina30BeforeCorrection.workingSets - movedWorkingSets,
        "Crossing the 30-day cutoff must remove exactly this workout's working sets");
      assert.equal(after30.completedSessions, amina30BeforeCorrection.completedSessions - 1,
        "Crossing the 30-day cutoff must remove exactly one completed session");
      const before = amina30BeforeCorrection.selected;
      const [direct, indirect] = before.directIndirect.split(" / ").map(Number);
      const weightedSets = Number(before.weightedSets) - bench.sets.length;
      const weeklyLoad = weightedSets * 7 / 30;
      assert.equal(after30.selected.directIndirect, `${direct - bench.sets.length} / ${indirect}`,
        "The selected chest details must exclude the corrected session's direct sets");
      assert.equal(Number(after30.selected.totalSets), Number(before.totalSets) - bench.sets.length);
      assert.equal(after30.selected.weightedSets, weightedSets.toFixed(2));
      assert.equal(after30.selected.weeklyLoad, weeklyLoad.toFixed(2),
        "The remaining workload must use the 30-day weekly-equivalent scale");
      const [intensity, label] = weeklyLoad <= 0 ? ["none", "No recorded work"]
        : weeklyLoad < 3 ? ["low", "Low"]
        : weeklyLoad < 6 ? ["moderate", "Moderate"]
        : weeklyLoad < 10 ? ["high", "High"] : ["very-high", "Very high"];
      assert.equal(after30.selected.intensity, intensity, "The muscle map must use the remaining workload's intensity");
      assert.equal(after30.selected.workload, `Chest: ${label}, ${weeklyLoad.toFixed(2)} weighted sets/week`,
        "The muscle map must exclude the corrected session's exact weekly-equivalent workload");
      assert.notEqual(after30.selected.workload, before.workload);
    }
    assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina"), aminaAfterCorrection,
      "Moving an already excluded workout across the 30-day cutoff must not change the seven-day chart");
    assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest", 30), leo30BeforeCorrection,
      "Another client's 30-day chart must remain unchanged");

    await reloadAndWait(page, "reloaded 30-day boundary correction", "dashboard-muscle-activity");
    assert.deepEqual((await storedState(page)).clients, expectedClients, "The exact corrected date must survive reload");
    assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30), after30,
      "The corrected 30-day totals and muscle map must survive reload");
    assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina"), aminaAfterCorrection,
      "The seven-day chart must remain accurate after reload");
    assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest", 30), leo30BeforeCorrection,
      "Another client's 30-day chart must remain unchanged after reload");
    assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo"), leoBeforeCorrection,
      "Another client's seven-day chart must remain unchanged after reload");
  }

  const excluded7DayChart = await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest");
  assert.deepEqual(excluded7DayChart, aminaAfterCorrection,
    "The session must still be excluded from the seven-day chart before restoring it");
  assert.ok(excluded30DayChart, "The session must be excluded from the 30-day chart before restoring it");

  // Restore the session to the 30-day window while keeping it outside the seven-day window.
  expectedSession.date = dateDaysAgo(8);
  await openSavedSessionEditor(page, baseUrl, session.id);
  await page.fill("input-edit-session-date", expectedSession.date);
  await page.click("button-editor-save");
  await waitFor("restored 30-day workout date saved", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "Restoring the date must preserve all non-date session data and every other client");
  const restored30DayChart = await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30);
  assertExactRestoredTotals(
    excluded30DayChart,
    restored30DayChart,
    amina30BeforeCorrection,
    30,
    "Restoring the workout to the 30-day window",
  );
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina"), aminaAfterCorrection,
    "Restoring the 30-day contribution must not add the workout to the seven-day chart");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest", 30), leo30BeforeCorrection,
    "Restoring Amina's workout must not change Leo's 30-day chart");
  await reloadAndWait(page, "reloaded restored 30-day workout", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "The restored date and all non-date client and session data must persist after reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30), restored30DayChart,
    "The exact restored 30-day set and muscle-map workload totals must persist after reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina"), aminaAfterCorrection,
    "The excluded seven-day chart must remain accurate after reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest", 30), leo30BeforeCorrection,
    "Leo's 30-day chart must remain unchanged after reload");

  // Restore the same workout into the seven-day window; both ranges should match their original totals.
  expectedSession.date = dateDaysAgo(6);
  await openSavedSessionEditor(page, baseUrl, session.id);
  await page.fill("input-edit-session-date", expectedSession.date);
  await page.click("button-editor-save");
  await waitFor("restored seven-day workout date saved", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "Restoring the seven-day date must preserve all non-date session data and every other client");
  const restored7DayChart = await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest");
  assertExactRestoredTotals(
    excluded7DayChart,
    restored7DayChart,
    aminaBeforeCorrection,
    7,
    "Restoring the workout to the seven-day window",
  );
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30), amina30BeforeCorrection,
    "Restoring the seven-day contribution must not double-count its 30-day workload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo"), leoBeforeCorrection,
    "Restoring Amina's workout must not change Leo's seven-day chart");
  await reloadAndWait(page, "reloaded restored seven-day workout", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "The seven-day restored date and all non-date client and session data must persist after reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina"), restored7DayChart,
    "The exact restored seven-day set and muscle-map workload totals must persist after reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30), amina30BeforeCorrection,
    "The 30-day workload must remain exact after reloading the seven-day restoration");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo"), leoBeforeCorrection,
    "Leo's seven-day chart must remain unchanged after reload");

  // A future date must be excluded from both recent windows without deleting
  // the saved workout or changing any of its non-date data.
  const futureDate = dateDaysAgo(-3);
  const beforeFuture7Day = await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 7);
  const beforeFuture30Day = await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30);
  await openSavedSessionEditor(page, baseUrl, session.id);
  await page.fill("input-edit-session-date", futureDate);
  await page.click("button-editor-save");
  await waitFor("future workout date saved", async () => {
    const client = (await storedState(page)).clients.find((item) => item.id === "seed-amina");
    return client?.sessions.find((item) => item.id === session.id)?.date;
  }, (date) => date === futureDate);

  const expectedFutureClients = structuredClone(expectedClients);
  expectedFutureClients.find((item) => item.id === "seed-amina")
    .sessions.find((item) => item.id === session.id).date = futureDate;
  assert.deepEqual((await storedState(page)).clients, expectedFutureClients,
    "Moving the workout into the future must preserve all other clients and every non-date workout field");

  const future7Day = await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 7);
  const future30Day = await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30);
  for (const [period, before, after] of [
    [7, beforeFuture7Day, future7Day],
    [30, beforeFuture30Day, future30Day],
  ]) {
    assert.equal(after.workingSets, before.workingSets - movedWorkingSets,
      `A future-dated workout must remove all its working sets from the ${period}-day total`);
    assert.equal(after.completedSessions, before.completedSessions - 1,
      `A future-dated workout must be excluded from the ${period}-day completed-session total`);
    assert.equal(after.selected.totalSets, String(Number(before.selected.totalSets) - bench.sets.length),
      `A future-dated workout must remove its direct chest sets from the ${period}-day total`);
    const [direct, indirect] = before.selected.directIndirect.split(" / ").map(Number);
    assert.equal(after.selected.directIndirect, `${direct - bench.sets.length} / ${indirect}`,
      `The ${period}-day chest breakdown must exclude the future workout's direct sets`);
    const weighted = Number(before.selected.weightedSets) - benchWeightedSets;
    assert.equal(after.selected.weightedSets, weighted.toFixed(2),
      `The ${period}-day chest workload must exclude the future workout's effort-weighted sets`);
    assert.equal(after.selected.weeklyLoad, (weighted * 7 / period).toFixed(2),
      `The ${period}-day muscle-map workload must exclude the future workout's contribution`);
    assert.notEqual(after.selected.workload, before.selected.workload,
      `The ${period}-day chest muscle-map label must update when the workout is future-dated`);
    assert.notDeepEqual(after.mapRegions, before.mapRegions,
      `The ${period}-day muscle map must exclude the future workout's workload`);
  }
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest", 7), leoBeforeCorrection,
    "Moving Amina's workout into the future must not change Leo's seven-day chart");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest", 30), leo30BeforeCorrection,
    "Moving Amina's workout into the future must not change Leo's 30-day chart");

  await reloadAndWait(page, "reloaded future-dated workout", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, expectedFutureClients,
    "The future date and unchanged workout contents must persist after reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 7), future7Day,
    "The seven-day exclusion and muscle-map workload must persist after reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30), future30Day,
    "The 30-day exclusion and muscle-map workload must persist after reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest", 7), leoBeforeCorrection,
    "Leo's seven-day chart must remain unchanged after the reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest", 30), leo30BeforeCorrection,
    "Leo's 30-day chart must remain unchanged after the reload");

  expectedSession.date = dateDaysAgo(6);
  await openSavedSessionEditor(page, baseUrl, session.id);
  await page.fill("input-edit-session-date", expectedSession.date);
  await page.click("button-editor-save");
  await waitFor("restored future-dated workout", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "Restoring the workout from a future date must preserve all non-date data");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 7), restored7DayChart,
    "Restoring the date must restore the exact seven-day totals and muscle-map workload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30), amina30BeforeCorrection,
    "Restoring the date must restore the exact 30-day totals and muscle-map workload");
  await reloadAndWait(page, "reloaded restored future-dated workout", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "The restored date and workout contents must persist after reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 7), restored7DayChart,
    "The restored seven-day totals and muscle-map workload must remain exact after reload");
  assert.deepEqual(await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30), amina30BeforeCorrection,
    "The restored 30-day totals and muscle-map workload must remain exact after reload");
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

  await page.fill("input-set-weight", "60.625");
  await page.fill("input-set-reps", "5");
  await page.fill("input-set-rir", "1");
  await page.click("button-minimize-session");
  await waitFor("minimized workout", () => page.evaluate(
    'document.querySelector(\'[data-testid="button-resume-session"]\') !== null',
  ));
  await switchWorkoutUnitAndReload(page, baseUrl, "lb");
  await page.click("button-minimize-session");
  await waitFor("minimized workout after pounds check", () => page.evaluate(
    'document.querySelector(\'[data-testid="button-resume-session"]\') !== null',
  ));
  await switchWorkoutUnitAndReload(page, baseUrl, "kg");
  await page.click("button-minimize-session");
  await waitFor("minimized workout after kilograms check", () => page.evaluate(
    'document.querySelector(\'[data-testid="button-resume-session"]\') !== null',
  ));
  return await storedState(page);
}

async function changeThemeAndReload(page, baseUrl, nextAppearance, savedClients) {
  await navigate(page, `${baseUrl}/settings`, "select-appearance");
  assert.equal(
    await page.evaluate('document.querySelectorAll(\'[data-testid^="button-appearance-"]\').length'),
    2,
    "Settings should expose only the two fixed themes",
  );
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
    weightKg: 60.625,
    reps: 6,
    rir: 0,
    kind: "normal",
    inputs: { weight: "60.625", reps: "6", rir: "0", unit: "kg" },
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

test("profile charts, workout logging, numeric inputs, and rest timer work across CoachAura themes", { timeout: 180000 }, async (t) => {
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
  assert.notEqual(themeSwatches.get("orange-charcoal"), themeSwatches.get("default"));
  await page.click("button-finish-session");
  await waitFor("final workout completion", () => page.evaluate(
    'document.querySelector(\'[data-testid="panel-workout-logger"]\') === null',
  ));
  const completed = (await storedState(page)).clients.find((item) => item.id === clientId);
  assert.equal(completed.sessions.at(-1)?.exercises[0]?.sets[0]?.weight, 52.5);
  assert.equal(completed.sessions.at(-1)?.exercises[0]?.sets[0]?.reps, 7);
  assert.equal(completed.sessions.at(-1)?.exercises[0]?.sets[0]?.rpe, 8);
  await assertAppearance(page, "default");
  await cancelSavedSetCorrectionAndVerifyUnchanged(page, baseUrl);
  t.diagnostic("Cancelling saved-set edits leaves client history and muscle charts unchanged");
  await rejectImpossibleSavedWorkoutDateAndVerifyUnchanged(page, baseUrl);
  t.diagnostic("Impossible saved-workout dates are rejected without changing history, while valid dates still save");
  await rejectEmptySavedWorkoutAndVerifyUnchanged(page, baseUrl);
  t.diagnostic("Saving a workout with every set removed is rejected; cancelling preserves history and charts");
  await addSavedSetAndVerifyCharts(page, baseUrl, initialClients);
  t.diagnostic("Adding a saved set updates only the intended client's direct and indirect muscle totals");
  await rejectInvalidSavedEffortAndVerifyUnchanged(page, baseUrl);
  t.diagnostic("Out-of-range and non-finite RIR corrections are rejected without changing storage or charts");
  await correctSavedEffortAndVerifyCharts(page, baseUrl);
  t.diagnostic("Effort boundaries, unchanged set counts, client isolation, and reload persistence verified");
  await correctSavedSetsAndVerifyCharts(page, baseUrl);
  t.diagnostic("Saved-set corrections verified; checking seven-day and 30-day date boundaries");
  await correctSavedSessionAndVerifyCharts(page, baseUrl);
  t.diagnostic("Date boundaries, client isolation, and reload persistence verified");
  const fixtureClient = structuredClone(initialClients.find((item) => item.id === "seed-amina"));
  fixtureClient.id = "test-last-recent-workout";
  fixtureClient.name = "Last recent workout fixture";
  fixtureClient.sessions = [structuredClone(fixtureClient.sessions[0])];
  fixtureClient.sessions[0].id = `${fixtureClient.id}-0`;
  fixtureClient.sessions[0].exercises = [
    fixtureClient.sessions[0].exercises.find((exercise) => exercise.name === "Barbell Bench Press"),
  ];
  await verifyLastRecentWorkoutCorrection(page, baseUrl, fixtureClient);
  t.diagnostic("Moving the last recent workout clears selected-period workload while retaining history and recovery");

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
