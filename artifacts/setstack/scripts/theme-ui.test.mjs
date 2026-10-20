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
import { formatLoad, fromDisplay, oneRm, toDisplay, todayIso } from "../src/lib/gymmane/engine.ts";
import { INDIVIDUAL_PROFILE_ID } from "../src/lib/gymmane/models.ts";
import { analyzeMuscleActivity, effortFactorFromRpe, mapExerciseMuscles, MUSCLE_GROUPS } from "../src/lib/gymmane/muscle-activity.ts";
import { kExercises } from "../src/lib/gymmane/catalog.ts";

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

async function swipeAdjust(page, testId, direction) {
  return page.evaluate(`(async () => {
    const input = document.querySelector('[data-testid="${testId}"]');
    if (!input) return null;
    const rect = input.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const pointerId = 731;
    input.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, pointerId, pointerType: "touch",
      isPrimary: true, button: 0, clientX: x, clientY: y
    }));
    await new Promise((resolve) => setTimeout(resolve, 250));
    const heldScale = input.className.includes("scale-[1.035]");
    input.dispatchEvent(new PointerEvent("pointermove", {
      bubbles: true, cancelable: true, pointerId, pointerType: "touch",
      isPrimary: true, button: 0, clientX: x + (${direction} * 50), clientY: y
    }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    const result = {
      heldScale,
      value: input.value,
      direction: input.getAttribute("data-adjust-direction"),
      animations: input.getAnimations().filter((animation) => animation.playState !== "idle").length
    };
    input.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, pointerId, pointerType: "touch",
      isPrimary: true, button: 0, clientX: x + (${direction} * 50), clientY: y
    }));
    return result;
  })()`);
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
  const achievementSummary = await page.evaluate(`({
    count: document.querySelector('[data-testid="achievement-count"]')?.textContent,
    categories: document.querySelectorAll('[role="tablist"][aria-label="Achievement categories"] [role="tab"]').length,
    measurementBadge: document.querySelector('[data-testid="achievement-badge-first-body-measurement"]')?.getAttribute("aria-label"),
    totalVisibleBadges: document.querySelectorAll('[data-testid^="achievement-badge-"]').length
  })`);
  assert.match(achievementSummary.count ?? "", /\d+ \/ 15 earned/, "The gallery should show the earned count out of supported milestones");
  assert.equal(achievementSummary.categories, 4, "All four achievement categories should be available");
  assert.equal(achievementSummary.totalVisibleBadges, 5, "The selected category should show only its five workout badges");
  await page.click("achievement-category-progress");
  const progressCategory = await page.evaluate(`({
    visibleBadges: document.querySelectorAll('[data-testid^="achievement-badge-"]').length,
    measurementBadge: document.querySelector('[data-testid="achievement-badge-first-body-measurement"]')?.getAttribute("aria-label")
  })`);
  assert.equal(progressCategory.visibleBadges, 2, "The progress category should display its two data-supported badges");
  assert.match(progressCategory.measurementBadge ?? "", /earned/, "The saved bodyweight entry should unlock its measurement badge");
  await page.click("achievement-badge-first-body-measurement");
  await waitFor("body measurement achievement detail", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="achievement-detail-first-body-measurement"] [data-testid="achievement-milestone"]\')',
  ));
  const achievementDetail = await page.evaluate(`({
    title: document.querySelector('#workspace-modal-title')?.textContent,
    date: document.querySelector('[data-testid="achievement-unlock-date"]')?.textContent,
    milestone: document.querySelector('[data-testid="achievement-milestone"]')?.textContent
  })`);
  assert.match(achievementDetail.title ?? "", /First Body Measurement/);
  assert.ok(achievementDetail.date, "An earned badge should show its unlock date");
  assert.match(achievementDetail.milestone ?? "", /First dated bodyweight entry/);
  await page.click("button-close-dialog");

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

async function muscleChartSnapshot(page, baseUrl, clientId, muscle = "chest", period = 7, includeRecoveryHours = false) {
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
      ...( ${includeRecoveryHours} ? { recoveryHours: Number(document.querySelector('[data-testid="status-muscle-recovery"]')?.getAttribute("data-estimated-recovery-hours")) } : {}),
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
  session.date = todayIso();
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
  assert.equal(after.selected.weightedSets, "0.000", "The selected muscle should have zero weighted sets");
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

async function renameSavedWorkoutAndVerifyCharts(page, baseUrl) {
  const beforeState = await storedState(page);
  const amina = beforeState.clients.find((client) => client.id === "seed-amina");
  const session = amina?.sessions.find((item) => item.id === "seed-amina-1");
  assert.ok(session, "Amina's saved workout should be available to rename");
  const renamed = `${session.name} (renamed)`;
  const expectedClients = structuredClone(beforeState.clients);
  const expectedSession = expectedClients.find((client) => client.id === amina.id)
    .sessions.find((item) => item.id === session.id);
  expectedSession.name = renamed;

  const chartSnapshot = async () => ({
    chest7: await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 7),
    triceps7: await muscleChartSnapshot(page, baseUrl, "seed-amina", "triceps", 7),
    quadriceps7: await muscleChartSnapshot(page, baseUrl, "seed-amina", "quadriceps", 7),
    chest30: await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30),
    otherClientChest: await muscleChartSnapshot(page, baseUrl, "seed-leo", "chest", 7),
  });
  const beforeCharts = await chartSnapshot();

  await openSavedSessionEditor(page, baseUrl, session.id);
  await page.fill("input-edit-session-name", renamed);
  await page.click("button-editor-save");
  await waitFor("renamed saved workout", async () => {
    const client = (await storedState(page)).clients.find((item) => item.id === amina.id);
    return client?.sessions.find((item) => item.id === session.id)?.name;
  }, (name) => name === renamed);

  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "Renaming a workout must change only its name in all stored client history");
  assert.deepEqual(await chartSnapshot(), beforeCharts,
    "Renaming a workout must not change any checked muscle chart snapshot");

  await navigate(page, `${baseUrl}/clients/${amina.id}?tab=history`, "button-client-start-session");
  assert.ok(await page.evaluate(`Array.from(document.querySelectorAll("summary"))
    .some((summary) => summary.textContent.includes(${JSON.stringify(renamed)}))`),
  "Workout history should display the saved new name");
  await navigate(page, `${baseUrl}/clients/${amina.id}?tab=muscles`, "client-training-analytics");
  await reloadAndWait(page, "reloaded renamed workout and client muscle dashboard", "client-training-analytics");

  const persistedClients = (await storedState(page)).clients;
  assert.deepEqual(persistedClients, expectedClients,
    "Reload must preserve the renamed workout without changing any other history data");
  assert.deepEqual(await chartSnapshot(), beforeCharts,
    "The client's muscle charts must remain unchanged after reloading the renamed workout");
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
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="text-editor-error"]\')?.textContent',
  ), undefined, "Correcting the date should immediately clear its stale validation message");
  await page.click("button-editor-save");
  await waitFor("valid saved-workout date correction", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="text-editor-error"]\')',
  ), null, "A successful save should close the editor without leaving an outdated error");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "A valid date should save while preserving all other client and workout data");

  await reloadAndWait(page, "reloaded valid saved-workout date correction", "button-client-start-session");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "The valid date and unchanged workout data should persist after reload");
}

async function addSavedSetAndVerifyCharts(page, baseUrl, sourceClients, debugPort) {
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
  const chartSnapshotForPage = async (targetPage, ownerId) => ({
    chest: await muscleChartSnapshot(targetPage, baseUrl, ownerId, "chest"),
    triceps: await muscleChartSnapshot(targetPage, baseUrl, ownerId, "triceps"),
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
  const beforeFailedSaveRaw = await page.evaluate('localStorage.getItem("setstack-v1")');
  await page.evaluate(`(() => {
    window.__coachauraFailNextSetstackWrite = true;
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === "setstack-v1" && window.__coachauraFailNextSetstackWrite) {
        window.__coachauraFailNextSetstackWrite = false;
        throw new DOMException("Simulated storage write failure", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    };
  })()`);
  await page.click("button-editor-save");
  await waitFor("failed saved-workout write warning", () => page.evaluate(
    'document.querySelector(\'[data-testid="button-retry-storage"]\') !== null',
  ));
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') !== null',
  ), true, "The saved-workout editor must remain open after a failed storage write");
  assert.equal(await page.evaluate(
    `document.querySelector('[data-testid="input-editor-weight-${newSetId}"]')?.value`,
  ), displayWeight, "The newly entered load must remain in the editor after the failed write");
  assert.equal(await page.evaluate(
    `document.querySelector('[data-testid="input-editor-reps-${newSetId}"]')?.value`,
  ), String(expectedReps), "The newly entered reps must remain in the editor after the failed write");
  assert.equal(await page.evaluate(
    `document.querySelector('[data-testid="input-editor-rir-${newSetId}"]')?.value`,
  ), String(expectedRir), "The newly entered effort must remain in the editor after the failed write");
  assert.equal(await page.evaluate(
    'localStorage.getItem("setstack-v1")',
  ), beforeFailedSaveRaw, "The failed write must leave the saved workout byte-for-byte unchanged");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="text-editor-error"]\')?.textContent',
  ), "Could not save this workout.", "The editor must report that the save did not complete");

  const chartPage = await openPage(debugPort);
  try {
    // A second tab hydrates the last committed storage while the original tab
    // keeps the failed edit and entered values mounted for an in-place retry.
    assert.deepEqual(
      await chartSnapshotForPage(chartPage, fixture.id),
      before,
      "A failed save must leave the client's visible muscle charts unchanged",
    );
    assert.deepEqual(
      await chartSnapshotForPage(chartPage, "seed-leo"),
      otherBefore,
      "A failed save must leave other clients' muscle charts unchanged",
    );
  } finally {
    await chartPage.close();
  }

  await page.click("button-retry-storage");
  await waitFor("storage retry to clear the failure warning", () => page.evaluate(
    'document.querySelector(\'[data-testid="button-retry-storage"]\') === null',
  ));
  assert.equal(await page.evaluate(
    `document.querySelector('[data-testid="input-editor-weight-${newSetId}"]')?.value`,
  ), displayWeight, "Checking storage again must preserve the added set's load for retry");
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
      (Number(initial.selected.weightedSets) + weightedDelta).toFixed(3),
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

  const beforeWarmupState = await storedState(page);
  const warmupBaseline = await clientSnapshot(fixture.id);
  const warmupOtherBaseline = await clientSnapshot("seed-leo");
  const expectedWarmupClients = structuredClone(beforeWarmupState.clients);
  const expectedWarmupBench = expectedWarmupClients.find((client) => client.id === fixture.id)
    .sessions.find((item) => item.id === session.id)
    .exercises.find((exercise) => exercise.id === bench.id);

  await openSavedSessionEditor(page, baseUrl, session.id, fixture.id);
  await page.click(`button-editor-add-set-${bench.id}`);
  await waitFor("new saved-workout warm-up row", () => page.evaluate(
    `document.querySelectorAll('[data-testid="editor-exercise-${bench.id}"] [data-testid^="editor-set-"]').length`,
  ), (count) => count === expectedWarmupBench.sets.length + 1);
  const warmupSetId = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    const rows = [...(section?.querySelectorAll('[data-testid^="editor-set-"]') ?? [])];
    return rows.at(-1)?.getAttribute("data-testid")?.replace("editor-set-", "");
  })()`);
  assert.ok(warmupSetId, "The newly added warm-up should have an editor row");
  const warmupWeightKg = 25;
  const warmupReps = 12;
  const warmupRir = 4;
  await page.fill(`input-editor-weight-${warmupSetId}`,
    String(Number(toDisplay(warmupWeightKg, beforeWarmupState.unit).toFixed(2))));
  await page.fill(`input-editor-reps-${warmupSetId}`, String(warmupReps));
  await page.fill(`input-editor-rir-${warmupSetId}`, String(warmupRir));
  await page.fill(`select-editor-kind-${warmupSetId}`, "warmup");
  await page.click("button-editor-save");
  await waitFor("new saved-workout warm-up persisted", async () => {
    const client = (await storedState(page)).clients.find((item) => item.id === fixture.id);
    return client?.sessions.find((item) => item.id === session.id)
      ?.exercises.find((exercise) => exercise.id === bench.id)?.sets.length;
  }, (count) => count === expectedWarmupBench.sets.length + 1);

  const afterWarmupState = await storedState(page);
  const storedWarmup = afterWarmupState.clients.find((client) => client.id === fixture.id)
    ?.sessions.find((item) => item.id === session.id)
    ?.exercises.find((exercise) => exercise.id === bench.id)?.sets.at(-1);
  assert.ok(storedWarmup?.id && !expectedWarmupBench.sets.some((set) => set.id === storedWarmup.id),
    "The added warm-up should have its own persisted set ID");
  const expectedWarmup = {
    id: storedWarmup.id,
    weight: warmupWeightKg,
    reps: warmupReps,
    rpe: 10 - warmupRir,
    kind: "warmup",
  };
  const savedWarmupId = storedWarmup.id;
  assert.deepEqual(storedWarmup, expectedWarmup,
    "The added warm-up must retain its entered load, reps, effort, and type");
  expectedWarmupBench.sets.push(expectedWarmup);
  assert.deepEqual(afterWarmupState.clients, expectedWarmupClients,
    "Saving a warm-up should store it without changing unrelated workout data");
  assert.deepEqual(await clientSnapshot(fixture.id), warmupBaseline,
    "A newly added warm-up must not change working, direct/indirect, or weighted muscle totals");
  assert.deepEqual(await clientSnapshot("seed-leo"), warmupOtherBaseline,
    "Saving a warm-up must not change another client's muscle charts");

  await reloadAndWait(page, "reloaded added warm-up muscle dashboard", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, expectedWarmupClients,
    "The added warm-up and only its fixture workout must persist after reload");
  assert.deepEqual(await clientSnapshot(fixture.id), warmupBaseline,
    "All muscle totals must remain unchanged after reloading the saved warm-up");
  assert.deepEqual(await clientSnapshot("seed-leo"), warmupOtherBaseline,
    "Another client's charts must remain unchanged after reloading the warm-up");

  await navigate(page, `${baseUrl}/settings`, "button-export-backup");
  await page.evaluate(`(() => {
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      window.__coachauraWarmupBackupBlob = blob;
      return createObjectURL(blob);
    };
  })()`);
  await page.click("button-export-backup");
  await waitFor("warm-up backup export confirmation", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="backup-export-confirmation"]\')',
  ));
  const exportedSet = await page.evaluate(`(async () => {
    const blob = window.__coachauraWarmupBackupBlob;
    if (!blob) return null;
    const raw = await blob.text();
    sessionStorage.setItem("test-coachaura-warmup-backup", raw);
    const data = JSON.parse(raw);
    return data.clients.flatMap((client) => client.sessions)
      .flatMap((workout) => workout.exercises)
      .flatMap((exercise) => exercise.sets)
      .find((set) => set.id === "${savedWarmupId}") ?? null;
  })()`);
  assert.deepEqual(exportedSet, expectedWarmup,
    "The existing export flow should include the warm-up's original type and values");
  await page.click("button-backup-not-saved");

  await page.evaluate(`(() => {
    const stored = JSON.parse(localStorage.getItem("setstack-v1"));
    const client = stored.state.clients.find((item) => item.id === "${fixture.id}");
    const workout = client.sessions.find((item) => item.id === "${session.id}");
    const set = workout.exercises.find((exercise) => exercise.id === "${bench.id}")
      .sets.find((item) => item.id === "${savedWarmupId}");
    Object.assign(set, { weight: 1, reps: 1, rpe: 1, kind: "normal" });
    localStorage.setItem("setstack-v1", JSON.stringify(stored));
  })()`);
  await reloadAndWait(page, "settings after editing the current warm-up copy", "button-import-backup");
  const selectedFile = await page.evaluate(`(() => {
    const input = document.querySelector('[data-testid="input-backup-file"]');
    const raw = sessionStorage.getItem("test-coachaura-warmup-backup");
    if (!raw) return false;
    const file = new File([raw], "coachaura-warmup-backup.json", {
      type: "application/json",
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    Object.defineProperty(input, "files", { configurable: true, value: transfer.files });
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  assert.equal(selectedFile, true, "The exported JSON should be selected through the existing restore file input");
  await waitFor("warm-up backup restore preview", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="button-confirm-restore"]\')',
  ));
  await page.click("button-confirm-restore");
  await waitFor("restored warm-up values", async () => {
    const client = (await storedState(page)).clients.find((item) => item.id === fixture.id);
    return client?.sessions.find((item) => item.id === session.id)
      ?.exercises.find((exercise) => exercise.id === bench.id)?.sets
      .find((set) => set.id === savedWarmupId);
  }, (set) => set?.kind === "warmup" && set.weight === warmupWeightKg &&
    set.reps === warmupReps && set.rpe === 10 - warmupRir);
  const restoredWarmupState = await storedState(page);
  assert.deepEqual(restoredWarmupState.clients, expectedWarmupClients,
    "Restoring the exported backup should recover the original saved workout and warm-up");
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
      assert.equal(actual.selected.weightedSets, (Number(initial.selected.weightedSets) - weighted).toFixed(3),
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

async function correctSavedLoadAndVerifyStrengthHistory(page, baseUrl) {
  const beforeState = await storedState(page);
  const amina = beforeState.clients.find((client) => client.id === "seed-amina");
  const session = amina?.sessions.find((item) => item.id === "seed-amina-0");
  const bench = session?.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.ok(session && bench, "Amina's latest completed workout should contain a bench press");
  const strongestSet = bench.sets
    .filter((set) => set.kind !== "warmup" && set.reps > 0)
    .reduce((best, set) => !best || oneRm(set.reps, set.weight, set.rpe) > oneRm(best.reps, best.weight, best.rpe) ? set : best, null);
  assert.ok(strongestSet, "The saved bench press should have a working set for strength history");
  const correctedDisplayLoad = Number(toDisplay(strongestSet.weight, beforeState.unit).toFixed(2)) + 5;
  const correctedWeightKg = fromDisplay(correctedDisplayLoad, beforeState.unit);
  const correctedEstimate = Math.max(...bench.sets.map((set) =>
    set.kind !== "warmup" && set.reps > 0 ? oneRm(set.reps, set.weight, set.rpe) : 0,
  ));
  const muscleSnapshot = async (muscle) => muscleChartSnapshot(page, baseUrl, "seed-amina", muscle, 30);
  const beforeMuscles = {
    chest: await muscleSnapshot("chest"),
    triceps: await muscleSnapshot("triceps"),
  };

  await navigate(page, `${baseUrl}/clients/seed-amina?tab=muscles`, "dashboard-muscle-activity");
  await page.fill("select-client-strength-exercise", bench.id);
  const beforeEstimate = await waitFor("selected bench press strength estimate", () => page.evaluate(
    'document.querySelector(\'[data-testid="select-client-strength-exercise"]\')?.value === '
      + JSON.stringify(bench.id)
      + ' ? document.querySelector(\'[data-testid="text-client-current-estimate"]\')?.textContent.trim() : null',
  ));
  assert.ok(beforeEstimate, "The bench press strength history should show a current estimate before correction");

  await openSavedSessionEditor(page, baseUrl, session.id);
  const expanded = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    const toggle = section?.querySelector("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    return !!toggle;
  })()`);
  assert.equal(expanded, true, "Expand the saved bench press sets");
  await page.fill(
    `input-editor-weight-${strongestSet.id}`,
    correctedDisplayLoad.toFixed(2),
  );
  await page.click("button-editor-save");
  await waitFor("valid saved-load correction", async () => {
    const client = (await storedState(page)).clients.find((item) => item.id === "seed-amina");
    return client?.sessions.find((item) => item.id === session.id)?.exercises
      .find((exercise) => exercise.id === bench.id)?.sets.find((set) => set.id === strongestSet.id)?.weight;
  }, (weight) => weight === correctedWeightKg);
  await waitFor("completed-workout editor closes after valid load correction", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));

  const expectedClients = structuredClone(beforeState.clients);
  const expectedClient = expectedClients.find((client) => client.id === "seed-amina");
  const expectedSession = expectedClient.sessions.find((item) => item.id === session.id);
  const expectedSet = expectedSession.exercises
    .find((exercise) => exercise.id === bench.id).sets
    .find((set) => set.id === strongestSet.id);
  expectedSet.weight = correctedWeightKg;
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "A valid load correction should persist only the corrected saved set");
  const expectedEstimate = Math.max(...expectedSession.exercises
    .find((exercise) => exercise.id === bench.id).sets
    .map((set) => set.kind !== "warmup" && set.reps > 0 ? oneRm(set.reps, set.weight, set.rpe) : 0));
  assert.ok(expectedEstimate > correctedEstimate,
    "Correcting the strongest load upward should raise the expected bench press estimate");

  const afterMuscles = {
    chest: await muscleSnapshot("chest"),
    triceps: await muscleSnapshot("triceps"),
  };
  for (const muscle of ["chest", "triceps"]) {
    const before = beforeMuscles[muscle];
    const after = afterMuscles[muscle];
    assert.equal(after.workingSets, before.workingSets,
      `${muscle}: changing a saved load must not change overall working-set counts`);
    assert.equal(after.completedSessions, before.completedSessions,
      `${muscle}: changing a saved load must not change completed-session counts`);
    assert.equal(after.selected.totalSets, before.selected.totalSets,
      `${muscle}: changing a saved load must not change total involved sets`);
    assert.equal(after.selected.directIndirect, before.selected.directIndirect,
      `${muscle}: direct and indirect set counts must remain stable`);
    assert.equal(after.selected.weightedSets, before.selected.weightedSets,
      `${muscle}: changing a saved load must not change effort-weighted set counts`);
    assert.equal(after.selected.weeklyLoad, before.selected.weeklyLoad,
      `${muscle}: set-based weekly-equivalent totals must remain stable`);
  }

  await navigate(page, `${baseUrl}/clients/seed-amina?tab=muscles`, "dashboard-muscle-activity");
  await page.fill("select-client-strength-exercise", bench.id);
  const actualEstimate = await waitFor("strength history reflects the corrected load", () => page.evaluate(
    'document.querySelector(\'[data-testid="select-client-strength-exercise"]\')?.value === '
      + JSON.stringify(bench.id)
      + ' ? document.querySelector(\'[data-testid="text-client-current-estimate"]\')?.textContent.trim() : null',
  ));
  assert.equal(actualEstimate, formatLoad(expectedEstimate, beforeState.unit),
    "The selected exercise's strength history should show the estimate from the corrected saved load");
  assert.notEqual(actualEstimate, beforeEstimate,
    "The corrected saved load should change the visible strength history estimate");

  await reloadAndWait(page, "reloaded valid load correction", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "The corrected canonical load and all other client records should persist after reload");
  await page.fill("select-client-strength-exercise", bench.id);
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="text-client-current-estimate"]\')?.textContent.trim()',
  ), formatLoad(expectedEstimate, beforeState.unit),
  "The corrected strength estimate should remain visible after reload");
  assert.deepEqual({
    chest: await muscleSnapshot("chest"),
    triceps: await muscleSnapshot("triceps"),
  }, afterMuscles, "Chest and triceps set counts should remain stable after reload");
}

async function verifyWarmupOnlyWorkoutHasNoStrengthRecords(page, baseUrl) {
  const originalStorage = await page.evaluate('localStorage.getItem("setstack-v1")');
  assert.ok(originalStorage, "The original browser fixture should be available for restoration");

  const fixtureId = "test-warmup-only-strength-history";
  const sessionId = `${fixtureId}-session`;
  const exerciseId = `${fixtureId}-exercise`;
  const setId = `${fixtureId}-set`;
  try {
    const stored = JSON.parse(originalStorage);
    const sourceClient = stored.state.clients.find((client) => client.id === "seed-amina");
    assert.ok(sourceClient, "A saved client should be available to build an isolated workout fixture");
    const fixture = structuredClone(sourceClient);
    fixture.id = fixtureId;
    fixture.name = "Warm-up-only strength fixture";
    fixture.sessions = [{
      id: sessionId,
      date: todayIso(),
      durationSec: 600,
      name: "Warm-up-only workout",
      routineId: null,
      exercises: [{
        id: exerciseId,
        name: "Warm-up Test Exercise",
        primary: "chest",
        equipment: "Barbell",
        sets: [{ id: setId, weight: 40, reps: 8, kind: "normal", rpe: null }],
      }],
    }];
    fixture.routines = [];
    fixture.weeklyPlan = {};
    stored.state.clients.push(fixture);
    await page.evaluate(`localStorage.setItem("setstack-v1", ${JSON.stringify(JSON.stringify(stored))})`);

    await navigate(page, `${baseUrl}/clients/${fixtureId}?tab=history`, "tab-history");
    const historyOpened = await page.evaluate(`(() => {
      const edit = document.querySelector('[data-testid="button-edit-session-${sessionId}"]');
      const details = edit?.closest("details");
      details?.querySelector("summary")?.click();
      return !!details?.open;
    })()`);
    assert.equal(historyOpened, true, "The saved workout should be available in the history editor");
    await page.click(`button-edit-session-${sessionId}`);
    await waitFor("warm-up fixture editor", () => page.evaluate(
      'document.querySelector(\'[data-testid="select-editor-kind-' + setId + '"]\') !== null',
    ));
    await page.fill(`select-editor-kind-${setId}`, "warmup");
    await page.click("button-editor-save");
    await waitFor("saved warm-up-only workout", async () => {
      const client = (await storedState(page)).clients.find((item) => item.id === fixtureId);
      return client?.sessions.find((session) => session.id === sessionId)?.exercises[0]?.sets[0]?.kind;
    }, (kind) => kind === "warmup");

    const updatedClient = (await storedState(page)).clients.find((client) => client.id === fixtureId);
    assert.equal(updatedClient?.sessions.length, 1, "Saving warm-ups must not remove the workout from history");
    assert.equal(updatedClient?.sessions[0]?.exercises[0]?.sets[0]?.kind, "warmup",
      "The saved set should retain its warm-up type");
    assert.ok(await page.evaluate(
      `document.querySelector('[data-testid="button-edit-session-${sessionId}"]') !== null`,
    ), "The saved warm-up-only workout should remain visible in history");

    await reloadAndWait(page, "reloaded warm-up-only workout history", "tab-history");
    const reloadedClient = (await storedState(page)).clients.find((client) => client.id === fixtureId);
    assert.deepEqual(reloadedClient?.sessions, updatedClient?.sessions,
      "The warm-up-only workout should remain saved after reload");
    assert.ok(await page.evaluate(
      `document.querySelector('[data-testid="button-edit-session-${sessionId}"]') !== null`,
    ), "The warm-up-only workout should still appear in history after reload");

    await navigate(page, `${baseUrl}/clients/${fixtureId}?tab=records`, "empty-personal-records");
    assert.equal(await page.evaluate(
      `document.querySelector('[data-testid="record-${exerciseId}"]') !== null`,
    ), false, "A warm-up-only set must not create a personal record");
    await navigate(page, `${baseUrl}/clients/${fixtureId}?tab=muscles`, "card-client-strength-trend");
    const strengthCard = await page.evaluate(`({
      hasStrengthOption: document.querySelector('[data-testid="select-client-strength-exercise"]') !== null,
      hasEstimate: document.querySelector('[data-testid="text-client-current-estimate"]') !== null,
      startsEmpty: document.querySelector('[data-testid="card-client-strength-trend"]')?.textContent.includes("Progress starts here")
    })`);
    assert.deepEqual(strengthCard, {
      hasStrengthOption: false,
      hasEstimate: false,
      startsEmpty: true,
    }, "A warm-up-only exercise must not appear in strength history or create a trend estimate");
  } finally {
    await page.evaluate(`localStorage.setItem("setstack-v1", ${JSON.stringify(originalStorage)})`);
    await loadPage(page, "Page.reload", { ignoreCache: true });
    await navigate(page, `${baseUrl}/clients/${clientId}?tab=muscles`, "card-client-strength-trend");
  }
}

async function enforceSavedLoadCeilingAndVerifyStrengthHistory(page, baseUrl) {
  const originalStorage = await page.evaluate('localStorage.getItem("setstack-v1")');
  assert.ok(originalStorage, "The original browser fixture should be available for restoration");
  const sourceState = JSON.parse(originalStorage).state;
  const sourceClient = sourceState.clients.find((client) => client.id === "seed-amina");
  const sourceSession = sourceClient?.sessions.find((item) => item.id === "seed-amina-0");
  const sourceBench = sourceSession?.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.ok(sourceClient && sourceSession && sourceBench, "The fixture should contain a saved bench workout");

  const fixture = structuredClone(sourceClient);
  fixture.id = "test-saved-load-ceiling";
  fixture.name = "Saved load ceiling fixture";
  fixture.sessions = [structuredClone(sourceSession)];
  const session = fixture.sessions[0];
  session.id = `${fixture.id}-session`;
  session.date = todayIso();
  const bench = session.exercises.find((exercise) => exercise.id === sourceBench.id);
  assert.ok(bench, "The fixture workout should retain the bench exercise");
  const workingSet = bench.sets.find((set) => set.kind !== "warmup" && set.reps > 0);
  assert.ok(workingSet, "The fixture should contain a working set to edit");
  const unit = sourceState.unit;
  const displayMaximum = Number(toDisplay(1_000, unit).toFixed(2));
  const inputId = `input-editor-weight-${workingSet.id}`;

  const readEstimate = async () => {
    const client = (await storedState(page)).clients.find((item) => item.id === fixture.id);
    const savedSession = client?.sessions.find((item) => item.id === session.id);
    const savedBench = savedSession?.exercises.find((exercise) => exercise.id === bench.id);
    assert.ok(savedBench, "The saved workout should retain its bench exercise");
    const estimates = savedBench.sets
      .filter((set) => set.kind !== "warmup" && set.reps > 0)
      .map((set) => oneRm(set.reps, set.weight, set.rpe));
    assert.ok(estimates.length > 0 && estimates.every(Number.isFinite),
      "Every derived strength-chart value should remain finite");
    return {
      session: savedSession,
      bench: savedBench,
      estimate: Math.max(...estimates),
    };
  };

  const assertChart = async (description) => {
    await navigate(page, `${baseUrl}/clients/${fixture.id}?tab=muscles`, "dashboard-muscle-activity");
    await page.fill("select-client-strength-exercise", bench.id);
    const saved = await readEstimate();
    const shown = await waitFor(description, () => page.evaluate(
      'document.querySelector(\'[data-testid="text-client-current-estimate"]\')?.textContent.trim()',
    ));
    assert.equal(shown, formatLoad(saved.estimate, unit),
      "The strength chart's visible estimate should match its finite saved-set calculation");
    return saved;
  };

  try {
    const isolatedStore = JSON.parse(originalStorage);
    isolatedStore.state.clients.push(fixture);
    await page.evaluate(`(() => {
      localStorage.setItem("setstack-v1", ${JSON.stringify(JSON.stringify(isolatedStore))});
      history.replaceState(null, "", ${JSON.stringify(`${baseUrl}/clients/${fixture.id}?tab=muscles`)});
    })()`);
    await reloadAndWait(page, "isolated saved-load ceiling fixture", "dashboard-muscle-activity");
    await page.fill("select-client-strength-exercise", bench.id);

    await openSavedSessionEditor(page, baseUrl, session.id, fixture.id);
    const expanded = await page.evaluate(`(() => {
      const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
      const toggle = section?.querySelector("button[aria-expanded]");
      if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
      return !!toggle;
    })()`);
    assert.equal(expanded, true, "Expand the working-set load input");
    assert.equal(await page.evaluate(
      `document.querySelector('[data-testid="${inputId}"]')?.max`,
    ), String(displayMaximum), "The input should expose the same unit-adjusted maximum used by validation");
    assert.ok((await page.evaluate("document.body.innerText"))
      .includes("Maximum 1,000 kg (2,204.62 lb)"),
      "The accepted load ceiling should be visible before saving");

    await page.fill(inputId, displayMaximum.toFixed(2));
    await page.click("button-editor-save");
    await waitFor("editor closes after saving the maximum allowed load", () => page.evaluate(
      'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
    ));
    let saved = await readEstimate();
    const boundarySet = saved.bench.sets.find((set) => set.id === workingSet.id);
    assert.ok(boundarySet && boundarySet.weight <= 1_000 && boundarySet.weight > 999.99,
      "The maximum displayed load should save as a finite canonical value at or below 1,000 kg");
    assert.ok(Number.isFinite(saved.estimate), "The accepted boundary must produce a finite strength estimate");
    saved = await assertChart("strength estimate for accepted load boundary");

    await reloadAndWait(page, "reloaded accepted saved-load boundary", "dashboard-muscle-activity");
    const reloaded = await assertChart("reloaded strength estimate for accepted load boundary");
    assert.deepEqual(reloaded.session, saved.session,
      "The accepted boundary workout should remain unchanged after reload");
    assert.ok(Number.isFinite(reloaded.estimate),
      "The accepted boundary's reloaded strength-chart estimate must remain finite");

    const rawBeforeRejectedSave = await page.evaluate('localStorage.getItem("setstack-v1")');
    await openSavedSessionEditor(page, baseUrl, session.id, fixture.id);
    const reopened = await page.evaluate(`(() => {
      const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
      const toggle = section?.querySelector("button[aria-expanded]");
      if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
      return !!toggle;
    })()`);
    assert.equal(reopened, true, "Reopen the saved workout to verify an oversized edit is rejected");
    await page.fillControlledValue(inputId, "1e308");
    await page.click("button-editor-save");
    const validation = await waitFor("visible validation for extremely large finite load", () => page.evaluate(`(() => {
      const error = document.querySelector('[data-testid="text-editor-error"]');
      return error && { text: error.textContent, visible: error.getClientRects().length > 0 };
    })()`), (value) => value?.visible === true);
    assert.equal(validation.text,
      "Barbell Bench Press, set 1: Load must be between 0 and 1,000 kg (2,204.62 lb).",
      "The editor should explain its finite maximum in both units");
    assert.equal(await page.evaluate('localStorage.getItem("setstack-v1")'), rawBeforeRejectedSave,
      "Rejecting the oversized finite load must leave saved storage byte-for-byte unchanged");
    assert.deepEqual(await readEstimate().then(({ session: savedSession }) => savedSession), saved.session,
      "Rejecting the oversized load must preserve the accepted saved workout");

    await page.click("button-editor-cancel");
    await waitFor("oversized saved-workout editor closes", () => page.evaluate(
      'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
    ));
    await navigate(page, `${baseUrl}/clients/${fixture.id}?tab=muscles`, "dashboard-muscle-activity");
    await reloadAndWait(page, "reloaded after rejected oversized load", "dashboard-muscle-activity");
    const afterRejectedReload = await assertChart("strength estimate after rejected oversized load reload");
    assert.deepEqual(afterRejectedReload.session, saved.session,
      "Reloading after rejection should retain the exact finite saved workout");
    assert.ok(Number.isFinite(afterRejectedReload.estimate),
      "Reloading after rejection should retain finite strength-chart values");
  } finally {
    await page.evaluate(`(() => {
      localStorage.setItem("setstack-v1", ${JSON.stringify(originalStorage)});
      history.replaceState(null, "", ${JSON.stringify(`${baseUrl}/`)});
    })()`);
    await reloadAndWait(page, "restored original load-ceiling fixture", "dashboard-columns");
  }
}

async function correctSharedMuscleContributorsAndVerifyCharts(page, baseUrl) {
  const beforeState = await storedState(page);
  const today = todayIso();
  const ownerId = "test-shared-muscle-contributors";
  const fixtureClient = structuredClone(seedClients(today).find((client) => client.id === "seed-amina"));
  fixtureClient.id = ownerId;
  fixtureClient.name = "Shared muscle contributors fixture";
  fixtureClient.sessions = [structuredClone(fixtureClient.sessions[0])];
  const session = fixtureClient.sessions[0];
  session.id = `${ownerId}-session`;
  session.date = today;

  const bench = session.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  const dumbbellCatalogExercise = kExercises.find((exercise) => exercise.name === "Dumbbell Bench Press");
  assert.ok(bench, "The saved workout should contain a barbell bench press");
  assert.ok(dumbbellCatalogExercise, "The exercise library should contain a dumbbell bench press");
  const dumbbellBench = {
    id: dumbbellCatalogExercise.id,
    name: dumbbellCatalogExercise.name,
    primary: dumbbellCatalogExercise.primary,
    equipment: dumbbellCatalogExercise.equipment,
    sets: structuredClone(bench.sets).map((set, index) => ({
      ...set,
      id: `${ownerId}-dumbbell-set-${index + 1}`,
      rpe: index === 0 ? 9 : 6,
    })),
  };
  session.exercises.push(dumbbellBench);

  await page.evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem("setstack-v1"));
    data.state.clients = data.state.clients.filter((client) => client.id !== ${JSON.stringify(ownerId)});
    data.state.clients.push(${JSON.stringify(fixtureClient)});
    localStorage.setItem("setstack-v1", JSON.stringify(data));
  })()`);
  await reloadAndWait(page, "multiple exercises contributing to the same muscle", "dashboard-muscle-activity");

  const snapshot = async () => ({
    chest: await muscleChartSnapshot(page, baseUrl, ownerId, "chest"),
    triceps: await muscleChartSnapshot(page, baseUrl, ownerId, "triceps"),
  });
  const contributorsByExercise = (muscle) => Object.fromEntries(
    muscle.selected.contributors.map((contributor) => [
      contributor.exerciseId,
      parseContributorDetails(contributor),
    ]),
  );
  const assertContributorTotals = (charts, label) => {
    for (const [muscleName, chart] of Object.entries(charts)) {
      const contributions = chart.selected.contributors.map(parseContributorDetails);
      const [panelDirect, panelIndirect] = chart.selected.directIndirect.split(" / ").map(Number);
      assert.equal(contributions.reduce((sum, item) => sum + item.directSets, 0), panelDirect,
        `${label}: ${muscleName} contributor direct sets should sum to the panel`);
      assert.equal(contributions.reduce((sum, item) => sum + item.indirectSets, 0), panelIndirect,
        `${label}: ${muscleName} contributor indirect sets should sum to the panel`);
      assert.equal(
        contributions.reduce((sum, item) => sum + item.weightedSets, 0).toFixed(3),
        chart.selected.weightedSets,
        `${label}: ${muscleName} contributor weighted sets should sum to the panel`,
      );
    }
  };
  const before = await snapshot();
  const initialChest = contributorsByExercise(before.chest);
  const initialTriceps = contributorsByExercise(before.triceps);
  assert.deepEqual(initialChest[bench.id], { directSets: 2, indirectSets: 0, weightedSets: 2 },
    "The barbell press should have its own direct chest contribution");
  assert.deepEqual(initialChest[dumbbellBench.id], { directSets: 2, indirectSets: 0, weightedSets: 2 },
    "The dumbbell press should have its own direct chest contribution");
  assert.deepEqual(initialTriceps[bench.id], { directSets: 0, indirectSets: 2, weightedSets: 1 },
    "The barbell press should have its own indirect triceps contribution");
  assert.deepEqual(initialTriceps[dumbbellBench.id], { directSets: 0, indirectSets: 2, weightedSets: 1 },
    "The dumbbell press should have its own indirect triceps contribution");
  assertContributorTotals(before, "Initial workout");

  const expectedClients = structuredClone(beforeState.clients.filter((client) => client.id !== ownerId));
  expectedClients.push(structuredClone(fixtureClient));
  const expectedSession = expectedClients.find((client) => client.id === ownerId)
    .sessions.find((item) => item.id === session.id);
  const expectedBench = expectedSession.exercises.find((exercise) => exercise.id === bench.id);
  const expectedDumbbellBench = expectedSession.exercises.find((exercise) => exercise.id === dumbbellBench.id);

  // Adjust the barbell press effort. The dumbbell press must remain unchanged.
  expectedBench.sets[0].rpe = 9;
  await openSavedSessionEditor(page, baseUrl, session.id, ownerId);
  const benchExpanded = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    const toggle = section?.querySelector("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    return !!toggle;
  })()`);
  assert.equal(benchExpanded, true, "Expand the barbell press effort inputs");
  await waitFor("barbell press editor to expand", () => page.evaluate(
    `document.querySelector('[data-testid="editor-exercise-${bench.id}"] button[aria-expanded]')?.getAttribute("aria-expanded") === "true"`,
  ));
  await page.fill(`input-editor-rir-${bench.sets[0].id}`, "1");
  await page.click("button-editor-save");
  await waitFor("saved barbell press effort correction", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "Changing barbell press effort must persist only that set's correction");

  const afterEffort = await snapshot();
  const effortChest = contributorsByExercise(afterEffort.chest);
  const effortTriceps = contributorsByExercise(afterEffort.triceps);
  assert.deepEqual(effortChest[dumbbellBench.id], initialChest[dumbbellBench.id],
    "Changing barbell press effort must not change the dumbbell press chest row");
  assert.deepEqual(effortTriceps[dumbbellBench.id], initialTriceps[dumbbellBench.id],
    "Changing barbell press effort must not change the dumbbell press triceps row");
  assert.deepEqual(effortChest[bench.id], { directSets: 2, indirectSets: 0, weightedSets: 2.25 },
    "Only the barbell press chest weighted contribution should follow its corrected effort");
  assert.deepEqual(effortTriceps[bench.id], { directSets: 0, indirectSets: 2, weightedSets: 1.125 },
    "Only the barbell press triceps weighted contribution should follow its corrected effort");
  assertContributorTotals(afterEffort, "After barbell effort correction");

  // Remove one dumbbell set. The corrected barbell rows must remain unchanged.
  expectedDumbbellBench.sets.shift();
  await openSavedSessionEditor(page, baseUrl, session.id, ownerId);
  const dumbbellExpanded = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${dumbbellBench.id}"]');
    const toggle = section?.querySelector("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    return !!toggle;
  })()`);
  assert.equal(dumbbellExpanded, true, "Expand the dumbbell press saved sets");
  await waitFor("dumbbell press editor to expand", () => page.evaluate(
    `document.querySelector('[data-testid="editor-exercise-${dumbbellBench.id}"] button[aria-expanded]')?.getAttribute("aria-expanded") === "true"`,
  ));
  await page.click(`button-editor-remove-set-${dumbbellBench.sets[0].id}`);
  await page.click("button-editor-save");
  await waitFor("saved dumbbell press set removal", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "Removing a dumbbell press set must persist only that exercise's set change");

  const afterSetRemoval = await snapshot();
  const removalChest = contributorsByExercise(afterSetRemoval.chest);
  const removalTriceps = contributorsByExercise(afterSetRemoval.triceps);
  assert.deepEqual(removalChest[bench.id], effortChest[bench.id],
    "Removing a dumbbell set must not change the corrected barbell chest row");
  assert.deepEqual(removalTriceps[bench.id], effortTriceps[bench.id],
    "Removing a dumbbell set must not change the corrected barbell triceps row");
  assert.deepEqual(removalChest[dumbbellBench.id], { directSets: 1, indirectSets: 0, weightedSets: 0.75 },
    "The dumbbell chest row should retain only its remaining set and effort");
  assert.deepEqual(removalTriceps[dumbbellBench.id], { directSets: 0, indirectSets: 1, weightedSets: 0.375 },
    "The dumbbell triceps row should retain only its remaining indirect set");
  assertContributorTotals(afterSetRemoval, "After dumbbell set removal");

  await reloadAndWait(page, "reloaded shared-muscle contributor dashboard", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "Both saved-set edits must remain in the completed workout after reload");
  const afterReload = await snapshot();
  assert.deepEqual(afterReload, afterSetRemoval,
    "Per-exercise direct, indirect, and weighted contributions must persist after reload");
  assertContributorTotals(afterReload, "After reload");
}

async function correctSavedEffortAndVerifyCharts(page, baseUrl) {
  const beforeState = await storedState(page);
  const today = todayIso();
  const ownerId = "test-effort-recovery";
  const fixtureClient = structuredClone(seedClients(today).find((client) => client.id === "seed-amina"));
  fixtureClient.id = ownerId;
  fixtureClient.name = "Effort recovery fixture";
  fixtureClient.sessions = [structuredClone(fixtureClient.sessions[0])];
  const session = fixtureClient.sessions[0];
  session.id = `${ownerId}-session`;
  session.date = today;
  const bench = session.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.ok(bench, "The completed workout should contain a mapped bench press");
  session.exercises = [bench];
  await page.evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem("setstack-v1"));
    data.state.clients = data.state.clients.filter((client) => client.id !== ${JSON.stringify(ownerId)});
    data.state.clients.push(${JSON.stringify(fixtureClient)});
    localStorage.setItem("setstack-v1", JSON.stringify(data));
  })()`);
  await reloadAndWait(page, "isolated effort-recovery fixture", "dashboard-muscle-activity");

  assert.equal(bench.sets.length, 2);
  assert.ok(bench.sets.every((set) => set.kind === "normal" && set.rpe === 8),
    "Both bench sets should start at RIR 2, the ×1.0 effort factor");

  const snapshot = async (id, period = 30) => ({
    chest: await muscleChartSnapshot(page, baseUrl, id, "chest", period, true),
    triceps: await muscleChartSnapshot(page, baseUrl, id, "triceps", period, true),
  });
  const snapshotBothPeriods = async (id) => ({
    7: await snapshot(id, 7),
    30: await snapshot(id, 30),
  });
  const before = await snapshot(ownerId);
  const leoBefore = await snapshot("seed-leo");
  const originalBenchSets = structuredClone(bench.sets);
  const expectedClients = structuredClone(beforeState.clients);
  expectedClients.push(structuredClone(fixtureClient));
  const expectedRecoveryHours = (muscle) => analyzeMuscleActivity(
    expectedClients.find((client) => client.id === ownerId),
    kExercises,
    7,
    todayIso(),
  ).muscles.find((item) => item.id === muscle)?.estimatedRecoveryHours;
  const expectedSession = expectedClients.find((client) => client.id === ownerId)
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

    await openSavedSessionEditor(page, baseUrl, session.id, ownerId);
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

    const after = await snapshot(ownerId);
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
        (Number(initial.selected.weightedSets) + delta).toFixed(3),
        `${muscle}: weighted sets must follow the exact effort factor`);
      assert.equal(actual.selected.weeklyLoad,
        (Number(initial.selected.weeklyLoad) + delta * 7 / 30).toFixed(2),
        `${muscle}: 30-day weekly-equivalent load must follow the exact effort factor`);
      assert.equal(actual.selected.recoveryHours, expectedRecoveryHours(muscle),
        `${muscle}: recovery hours must reflect the corrected effort-weighted latest exposure`);
      if (correction.setIndex === 0 && correction.rir === 1) {
        assert.ok(actual.selected.recoveryHours > initial.selected.recoveryHours,
          `${muscle}: increasing effort in the latest exposure must lengthen its recovery estimate`);
      }

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
    assert.deepEqual(await snapshot(ownerId), after,
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
  const beforeClear = await snapshotBothPeriods(ownerId);
  const leoBeforeClear = await snapshot("seed-leo");
  const clearedSetIndex = 0;
  const clearedSet = expectedBench.sets[clearedSetIndex];
  const previousFactor = effortFactorFromRpe(clearedSet.rpe);
  assert.equal(effortFactorFromRpe(null), 1,
    "A cleared saved effort value must use the neutral ×1.0 factor");
  clearedSet.rpe = null;

  await openSavedSessionEditor(page, baseUrl, session.id, ownerId);
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
    clearedState.clients.find((client) => client.id === ownerId)
      ?.sessions.find((item) => item.id === session.id)
      ?.exercises.find((exercise) => exercise.id === bench.id)
      ?.sets.find((set) => set.id === clearedSet.id)?.rpe,
    null,
    "The cleared saved effort must be stored as null",
  );

  const afterClear = await snapshotBothPeriods(ownerId);
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
      assert.equal(actual.selected.recoveryHours, expectedRecoveryHours(muscle),
        `${period}-day ${muscle}: clearing effort must refresh the recovery estimate`);
      assert.notEqual(actual.selected.recoveryHours, initial.selected.recoveryHours,
        `${period}-day ${muscle}: clearing effort on the latest exposure must change the recovery estimate`);
    }
  }
  assert.deepEqual(await snapshot("seed-leo"), leoBeforeClear,
    "Clearing Amina's RIR must not change another client's charts");

  await reloadAndWait(page, "reloaded cleared RIR dashboard", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, expectedClients,
    "The null effort value must persist after reload");
  assert.deepEqual(await snapshotBothPeriods(ownerId), afterClear,
    "Direct and secondary neutral-weighted totals in both chart periods must persist after reload");
  assert.deepEqual(await snapshot("seed-leo"), leoBeforeClear,
    "Another client's charts must remain unchanged after reload");

  await navigate(page, `${baseUrl}/clients/${clientId}?tab=muscles`, "dashboard-muscle-activity");
  await page.evaluate(`(() => {
    const data = JSON.parse(localStorage.getItem("setstack-v1"));
    data.state.clients = data.state.clients.filter((client) => client.id !== ${JSON.stringify(ownerId)});
    localStorage.setItem("setstack-v1", JSON.stringify(data));
  })()`);
  await reloadAndWait(page, "restored effort-recovery test data", "dashboard-muscle-activity");
  assert.deepEqual((await storedState(page)).clients, beforeState.clients,
    "The isolated effort-recovery fixture must not change other test data");
}

async function rejectInvalidSavedLoadsAndVerifyUnchanged(page, baseUrl) {
  const beforeState = await storedState(page);
  const session = beforeState.clients.find((client) => client.id === "seed-amina")
    ?.sessions.find((item) => item.id === "seed-amina-2");
  const bench = session?.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.ok(session, "Amina's completed load-correction workout should exist");
  assert.ok(bench && bench.sets.length >= 2, "The completed workout should contain two bench press sets");
  const invalidLoadInputId = `input-editor-weight-${bench.sets[1].id}`;
  const rawBefore = await page.evaluate('localStorage.getItem("setstack-v1")');
  const sessionBefore = JSON.stringify(session);
  const changedDate = new Date(Date.parse(`${session.date}T12:00:00.000Z`) - 86_400_000)
    .toISOString().slice(0, 10);

  const snapshot = async () => ({
    chest: await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30),
    triceps: await muscleChartSnapshot(page, baseUrl, "seed-amina", "triceps", 30),
  });
  const beforeCharts = await snapshot();

  await openSavedSessionEditor(page, baseUrl, session.id);
  const expanded = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    const toggle = section?.querySelector("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    return !!toggle;
  })()`);
  assert.equal(expanded, true, "Expand the bench press load inputs");

  // Stage valid edits ahead of the invalid second-set load. None may persist
  // when validation rejects the completed-workout update.
  await page.fill("input-edit-session-name", "This valid name must not be partially saved");
  await page.fill("input-edit-session-date", changedDate);
  await page.fill(
    `input-editor-weight-${bench.sets[0].id}`,
    String(Number(toDisplay(bench.sets[0].weight + 5, beforeState.unit).toFixed(2))),
  );

  for (const load of ["-1", "Infinity", "NaN"]) {
    if (Number.isFinite(Number(load))) await page.fill(invalidLoadInputId, load);
    else await page.fillControlledValue(invalidLoadInputId, load);
    await page.click("button-editor-save");
    const validation = await waitFor(`visible validation for load ${load}`, () => page.evaluate(`(() => {
      const error = document.querySelector('[data-testid="text-editor-error"]');
      return error && { text: error.textContent, visible: error.getClientRects().length > 0 };
    })()`), (value) => value?.visible === true);
    assert.equal(validation.text,
      "Barbell Bench Press, set 2: check load, whole reps and RIR (0 to 10).",
      `Load ${load} should be rejected with the editor validation message`);
    assert.equal(await page.evaluate('localStorage.getItem("setstack-v1")'), rawBefore,
      `Rejecting load ${load} must leave persisted storage byte-for-byte unchanged`);
    const stateAfterAttempt = await storedState(page);
    const sessionAfterAttempt = stateAfterAttempt.clients.find((client) => client.id === "seed-amina")
      ?.sessions.find((item) => item.id === session.id);
    assert.equal(JSON.stringify(sessionAfterAttempt), sessionBefore,
      `Rejecting load ${load} must not partially overwrite the saved workout`);
  }

  await page.click("button-editor-cancel");
  await waitFor("invalid load editor closed", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  await navigate(page, `${baseUrl}/clients/seed-amina?tab=muscles&period=30`, "dashboard-muscle-activity");
  await reloadAndWait(page, "reloaded after rejected load corrections", "dashboard-muscle-activity");
  assert.equal(await page.evaluate('localStorage.getItem("setstack-v1")'), rawBefore,
    "Reloading after invalid load corrections must preserve exact saved storage");
  assert.deepEqual(await storedState(page), beforeState,
    "Reloading after invalid load corrections must preserve every saved client record");
  assert.deepEqual(await snapshot(), beforeCharts,
    "Rejected load corrections must leave direct/secondary workload and set counts unchanged after reload");
}

async function rejectInvalidSavedRepsAndVerifyUnchanged(page, baseUrl) {
  const beforeState = await storedState(page);
  const session = beforeState.clients.find((client) => client.id === "seed-amina")
    ?.sessions.find((item) => item.id === "seed-amina-2");
  const bench = session?.exercises.find((exercise) => exercise.name === "Barbell Bench Press");
  assert.ok(session, "Amina's completed rep-correction workout should exist");
  assert.ok(bench && bench.sets.length >= 2, "The completed workout should contain two bench press sets");
  const rawBefore = await page.evaluate('localStorage.getItem("setstack-v1")');
  const sessionBefore = JSON.stringify(session);
  const changedDate = new Date(Date.parse(`${session.date}T12:00:00.000Z`) - 86_400_000)
    .toISOString().slice(0, 10);

  const snapshot = async () => ({
    chest: await muscleChartSnapshot(page, baseUrl, "seed-amina", "chest", 30),
    triceps: await muscleChartSnapshot(page, baseUrl, "seed-amina", "triceps", 30),
  });
  const beforeCharts = await snapshot();

  await openSavedSessionEditor(page, baseUrl, session.id);
  const expanded = await page.evaluate(`(() => {
    const section = document.querySelector('[data-testid="editor-exercise-${bench.id}"]');
    const toggle = section?.querySelector("button[aria-expanded]");
    if (toggle?.getAttribute("aria-expanded") === "false") toggle.click();
    return !!toggle;
  })()`);
  assert.equal(expanded, true, "Expand the bench press rep inputs");

  // Stage otherwise-valid changes to ensure an invalid rep correction cannot
  // partially save the rest of the completed-workout edit.
  await page.fill("input-edit-session-name", "This valid name must not be partially saved");
  await page.fill("input-edit-session-date", changedDate);
  await page.fill(`input-editor-reps-${bench.sets[0].id}`, String(bench.sets[0].reps + 1));

  const invalidRepValues = ["0", "2.5", "101"];
  for (const reps of invalidRepValues) {
    await page.fill(`input-editor-reps-${bench.sets[1].id}`, reps);
    await page.click("button-editor-save");
    const validation = await waitFor(`visible validation for ${reps} reps`, () => page.evaluate(`(() => {
      const error = document.querySelector('[data-testid="text-editor-error"]');
      return error && { text: error.textContent, visible: error.getClientRects().length > 0 };
    })()`), (value) => value?.visible === true);
    assert.equal(validation.text,
      "Barbell Bench Press, set 2: check load, whole reps and RIR (0 to 10).",
      `${reps} reps should be rejected with the editor validation message`);
    assert.equal(await page.evaluate('localStorage.getItem("setstack-v1")'), rawBefore,
      `Rejecting ${reps} reps must leave persisted storage byte-for-byte unchanged`);
    const stateAfterAttempt = await storedState(page);
    const sessionAfterAttempt = stateAfterAttempt.clients.find((client) => client.id === "seed-amina")
      ?.sessions.find((item) => item.id === session.id);
    assert.equal(JSON.stringify(sessionAfterAttempt), sessionBefore,
      `Rejecting ${reps} reps must not partially overwrite the saved workout`);
  }

  await page.click("button-editor-cancel");
  await waitFor("invalid rep editor closed", () => page.evaluate(
    'document.querySelector(\'[data-testid="input-edit-session-date"]\') === null',
  ));
  await navigate(page, `${baseUrl}/clients/seed-amina?tab=muscles&period=30`, "dashboard-muscle-activity");
  await reloadAndWait(page, "reloaded after rejected rep corrections", "dashboard-muscle-activity");
  assert.equal(await page.evaluate('localStorage.getItem("setstack-v1")'), rawBefore,
    "Reloading after invalid rep corrections must preserve the exact saved storage");
  assert.deepEqual(await storedState(page), beforeState,
    "Reloading after invalid rep corrections must preserve every saved client record");
  assert.deepEqual(await snapshot(), beforeCharts,
    "Rejected rep corrections must leave direct/secondary workload and set counts unchanged after reload");
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
    assert.equal(restored.selected.weightedSets, expectedWeighted.toFixed(3),
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
      assert.equal(after30.selected.weightedSets, weightedSets.toFixed(3));
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
    assert.equal(after.selected.weightedSets, weighted.toFixed(3),
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
  assert.ok(await page.evaluate('!!document.querySelector(\'[data-testid="panel-workout-logger"] [data-testid^="exercise-map-"]\')'),
    "The live exercise should show its local muscle illustration without replacing logging controls");
  const currentUnit = (await storedState(page)).unit;
  for (const control of [
    { testId: "input-set-weight", label: "load", step: currentUnit === "kg" ? 0.5 : 1, unit: currentUnit, value: "10" },
    { testId: "input-set-reps", label: "reps", step: 1, value: "8" },
    { testId: "input-set-rir", label: "RIR", step: 0.5, value: "2" },
  ]) {
    const accessibility = await page.evaluate(`(() => {
      const input = document.querySelector('[data-testid="${control.testId}"]');
      const help = document.getElementById(input?.getAttribute("aria-describedby"));
      return {
        type: input?.type,
        step: input?.step,
        help: help?.textContent,
        decrease: document.querySelector('[data-testid="${control.testId}-decrease"]')?.getAttribute("aria-label"),
        increase: document.querySelector('[data-testid="${control.testId}-increase"]')?.getAttribute("aria-label"),
      };
    })()`);
    const amountLabel = `${control.step}${control.unit ? ` ${control.unit}` : ""}`;
    assert.equal(accessibility.type, "number", `${control.testId} remains directly editable as a numeric input`);
    assert.equal(accessibility.step, "any", `${control.testId} accepts exact typed decimal values`);
    assert.match(accessibility.help, /Enter a value, use the increase and decrease buttons, or use the keyboard arrow keys/);
    assert.match(accessibility.help, /swiping is optional/i);
    assert.equal(accessibility.decrease, `Decrease ${control.label} by ${amountLabel}`);
    assert.equal(accessibility.increase, `Increase ${control.label} by ${amountLabel}`);

    const before = await page.evaluate(`Number(document.querySelector('[data-testid="${control.testId}"]')?.value || 0)`);
    const increment = await swipeAdjust(page, control.testId, 1);
    assert.ok(increment?.heldScale, `${control.testId} scales while held`);
    assert.equal(increment?.direction, "increase", `${control.testId} signals an increase`);
    assert.ok(increment?.animations, `${control.testId} animates the changed value`);
    assert.equal(Number(increment?.value), before + control.step * 2,
      `${control.testId} applies rapid consecutive right-swipe steps immediately`);
    const decrement = await swipeAdjust(page, control.testId, -1);
    assert.equal(decrement?.direction, "decrease", `${control.testId} signals a decrease`);
    assert.equal(Number(decrement?.value), before, `${control.testId} applies left swipes without dropping steps`);

    await page.fill(control.testId, control.value);
    await page.click(`${control.testId}-increase`);
    await waitFor(`${control.label} increment button`, () => page.evaluate(
      `document.querySelector('[data-testid="${control.testId}"]')?.value`,
    ), (value) => Number(value) === Number(control.value) + control.step);
    assert.equal(await page.evaluate(
      `document.querySelector('[data-testid="${control.testId}-adjustment-status"]')?.textContent`,
    ), `${control.label} changed to ${Number(control.value) + control.step}${control.unit ? ` ${control.unit}` : ""}.`,
    `${control.label} adjustments announce their resulting value`);
    await page.click(`${control.testId}-decrease`);
    await waitFor(`${control.label} decrement button`, () => page.evaluate(
      `document.querySelector('[data-testid="${control.testId}"]')?.value`,
    ), (value) => value === control.value);

    const keyboard = await page.evaluate(`(() => {
      const input = document.querySelector('[data-testid="${control.testId}"]');
      const key = Object.keys(input).find((name) => name.startsWith("__reactProps$"));
      let prevented = false;
      input[key].onKeyDown({ key: "ArrowUp", preventDefault() { prevented = true; } });
      return prevented;
    })()`);
    assert.equal(keyboard, true, `${control.testId} handles keyboard arrow adjustment`);
    await waitFor(`${control.label} keyboard increment`, () => page.evaluate(
      `document.querySelector('[data-testid="${control.testId}"]')?.value`,
    ), (value) => Number(value) === Number(control.value) + control.step);
    assert.equal(await page.evaluate(
      `document.querySelector('[data-testid="${control.testId}-adjustment-status"]')?.textContent`,
    ), `${control.label} changed to ${Number(control.value) + control.step}${control.unit ? ` ${control.unit}` : ""}.`,
    `${control.label} keyboard adjustments announce their resulting value`);
    await page.evaluate(`(() => {
      const input = document.querySelector('[data-testid="${control.testId}"]');
      const key = Object.keys(input).find((name) => name.startsWith("__reactProps$"));
      input[key].onKeyDown({ key: "ArrowDown", preventDefault() {} });
    })()`);
    await waitFor(`${control.label} keyboard decrement`, () => page.evaluate(
      `document.querySelector('[data-testid="${control.testId}"]')?.value`,
    ), (value) => value === control.value);
  }
  const adjustedDraft = (await storedState(page)).draft;
  const entry = adjustedDraft.entries[adjustedDraft.exercises[adjustedDraft.activeIndex].id];
  assert.deepEqual(
    { weight: entry?.inputs?.weight, reps: entry?.inputs?.reps, rir: entry?.inputs?.rir },
    { weight: "10", reps: "8", rir: "2" },
    "Button and keyboard adjustments update the existing workout draft inputs",
  );

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

async function verifyExerciseIllustrations(page, baseUrl, appearance) {
  const originalStorage = await page.evaluate('localStorage.getItem("setstack-v1")');
  const before = await storedState(page);
  await navigate(page, `${baseUrl}/`, "button-open-library");
  await page.click("button-open-library");
  await waitFor("exercise library", () => page.evaluate('!!document.querySelector(\'[data-testid="input-search-library"]\')'));
  // One real catalog example for each primary muscle, without adding sample client records.
  const samples = [...new Map(kExercises.map((exercise) => [mapExerciseMuscles(exercise).primary, exercise])).values()];
  assert.equal(samples.length, 18);
  for (const exercise of samples) {
    const expected = mapExerciseMuscles(exercise);
    await page.fill("input-search-library", exercise.name);
    await waitFor(`illustration for ${exercise.name}`, () => page.evaluate(
      `!!document.querySelector('[data-testid="exercise-map-${exercise.id}"]')`,
    ));
    const observed = await page.evaluate(`(() => {
      const map = document.querySelector('[data-testid="exercise-map-${exercise.id}"]');
      const primary = map.querySelector('[data-role="primary"]');
      return {
        primary: map.dataset.primaryMuscle,
        secondary: map.dataset.secondaryMuscles.split(",").filter(Boolean).sort(),
        highlightedPrimary: [...new Set([...map.querySelectorAll('[data-role="primary"]')].map((region) => region.dataset.muscle))],
        highlightedSecondary: [...new Set([...map.querySelectorAll('[data-role="secondary"]')].map((region) => region.dataset.muscle))].sort(),
        views: [...map.querySelectorAll("svg")].map((svg) => svg.dataset.view),
        neutralRegions: map.querySelectorAll('[data-role="neutral"]').length,
        fill: getComputedStyle(primary).fill,
        animation: getComputedStyle(primary).animationDuration,
        primaryOpacity: primary.getAttribute("fill-opacity"),
        secondaryOpacity: map.querySelector('[data-role="secondary"]')?.getAttribute("fill-opacity"),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    })()`);
    assert.equal(observed.primary, expected.primary);
    assert.deepEqual(observed.secondary, [...expected.secondary].sort());
    assert.deepEqual(observed.highlightedPrimary, [expected.primary]);
    assert.deepEqual(observed.highlightedSecondary, [...expected.secondary].sort());
    assert.deepEqual(observed.views, ["front", "back"]);
    assert.ok(observed.neutralRegions > 0, "Untargeted anatomy remains neutral, including arms");
    assert.equal(observed.fill, appearance === "default" ? "rgb(183, 243, 74)" : "rgb(232, 168, 124)");
    assert.equal(observed.animation, "2.6s");
    assert.equal(observed.primaryOpacity, "0.92");
    if (expected.secondary.length) assert.equal(observed.secondaryOpacity, "0.54");
    assert.equal(observed.overflow, false, `${exercise.name} must fit a phone-width list`);
  }
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  assert.equal(await page.evaluate('getComputedStyle(document.querySelector(".exercise-muscle-primary")).animationName'), "none");
  await page.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "no-preference" }] });
  await page.send("Network.emulateNetworkConditions", { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  try {
    await page.fill("input-search-library", "Barbell Bench Press");
    await waitFor("offline bench illustration", () => page.evaluate('!!document.querySelector(\'[data-testid="exercise-map-EIeI8Vf-chest-primary"]\')'));
  } finally {
    await page.send("Network.emulateNetworkConditions", { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  }
  // A temporary fixture in this isolated browser verifies the neutral fallback.
  const fallbackStorage = JSON.parse(originalStorage);
  fallbackStorage.state.custom.push({
    id: "test-unmapped-illustration", name: "Unmapped illustration test", primary: "other",
    secondary: [], equipment: "Other", difficulty: "Beginner", mode: "",
  });
  try {
    await page.evaluate(`localStorage.setItem("setstack-v1", ${JSON.stringify(JSON.stringify(fallbackStorage))})`);
    await navigate(page, `${baseUrl}/`, "button-open-library");
    await page.click("button-open-library");
    await waitFor("fallback search", () => page.evaluate('!!document.querySelector(\'[data-testid="input-search-library"]\')'));
    await page.fill("input-search-library", "Unmapped illustration test");
    const fallback = await page.evaluate(`(() => {
      const map = document.querySelector('[data-testid="exercise-map-test-unmapped-illustration"]');
      return { primary: map?.dataset.primaryMuscle, highlighted: map?.querySelectorAll(".exercise-muscle-region").length, neutral: map?.querySelectorAll('[data-role="neutral"]').length };
    })()`);
    assert.equal(fallback.primary, "unmapped");
    assert.equal(fallback.highlighted, 0);
    assert.ok(fallback.neutral > 0);
  } finally {
    await page.evaluate(`localStorage.setItem("setstack-v1", ${JSON.stringify(originalStorage)})`);
  }
  await navigate(page, `${baseUrl}/clients/${clientId}`, "button-new-routine");
  await page.click("button-new-routine");
  await waitFor("routine exercise search", () => page.evaluate('!!document.querySelector(\'[data-testid="input-exercise-search"]\')'));
  await page.fill("input-exercise-search", "Barbell Bench Press");
  assert.ok(await page.evaluate('!!document.querySelector(\'[data-testid="button-add-exercise-EIeI8Vf"] [data-testid="exercise-map-EIeI8Vf-chest-primary"]\')'));
  await page.click("button-add-exercise-EIeI8Vf");
  assert.ok(await page.evaluate('!!document.querySelector(\'[data-testid="row-routine-exercise-EIeI8Vf"] [data-testid="exercise-map-EIeI8Vf"]\')'));
  await page.click("button-cancel-routine");
  assert.deepEqual((await storedState(page)).clients, before.clients, "Browsing illustrations and cancelling a routine must not alter client data");
}

async function verifyCustomExerciseMuscleContributors(page, baseUrl, fixtureClient) {
  const originalStorage = await page.evaluate('localStorage.getItem("setstack-v1")');
  assert.ok(originalStorage, "The original browser fixture should be available for restoration");
  const isolatedStore = JSON.parse(originalStorage);
  isolatedStore.state.clients = [structuredClone(fixtureClient)];
  isolatedStore.state.custom = [];
  isolatedStore.state.draft = null;
  await page.evaluate(`localStorage.setItem("setstack-v1", ${JSON.stringify(JSON.stringify(isolatedStore))})`);

  async function readContributorPanels(exerciseId) {
    const panels = {};
    for (const group of MUSCLE_GROUPS) {
      let visible = await page.evaluate(
        `!!document.querySelector('[data-testid="button-muscle-${group.id}"]')`,
      );
      if (!visible) {
        await page.click("button-muscle-view-front");
        visible = await page.evaluate(
          `!!document.querySelector('[data-testid="button-muscle-${group.id}"]')`,
        );
      }
      if (!visible) {
        await page.click("button-muscle-view-back");
        visible = await page.evaluate(
          `!!document.querySelector('[data-testid="button-muscle-${group.id}"]')`,
        );
      }
      assert.equal(visible, true, `The ${group.label} contributor panel should be selectable`);
      await page.click(`button-muscle-${group.id}`);
      panels[group.id] = await page.evaluate(`(() => {
        const row = document.querySelector('[data-testid="row-muscle-contributor-${exerciseId}"]');
        return row?.querySelector("p:last-child")?.textContent?.trim() ?? null;
      })()`);
    }
    return panels;
  }

  async function assertOnlyMappedPanels(expectedPrimary, expectedSecondary, exerciseId, description) {
    const panels = await readContributorPanels(exerciseId);
    const expected = new Set([expectedPrimary, expectedSecondary]);
    assert.deepEqual(
      Object.entries(panels).filter(([, details]) => details !== null).map(([group]) => group).sort(),
      [...expected].sort(),
      `${description}: the exercise should appear only in its configured primary and secondary panels`,
    );
    assert.equal(panels[expectedPrimary], "1 direct · 0 indirect sets · 1.000 weighted");
    assert.equal(panels[expectedSecondary], "0 direct · 1 indirect sets · 0.500 weighted");
  }

  try {
    await navigate(page, `${baseUrl}/`, "dashboard-columns");
    await navigate(page, `${baseUrl}/clients/${fixtureClient.id}`, "button-empty-create-routine");
    await page.click("button-empty-create-routine");
    await waitFor("custom exercise routine editor", () => page.evaluate(
      '!!document.querySelector(\'[data-testid="section-custom-exercise"]\')',
    ));
    await page.fill("input-routine-name", "Custom mapping regression");
    await page.click("button-expand-custom-exercise");
    await page.fill("input-custom-exercise-name", "Custom Chest Press");
    await page.fill("select-custom-primary-muscle", "chest");
    await page.click("checkbox-custom-secondary-calves");
    await page.click("button-create-custom-exercise");
    await waitFor("created mapped custom exercise", async () => {
      const state = await storedState(page);
      return state.custom.find((exercise) => exercise.name === "Custom Chest Press");
    }, (exercise) => exercise?.primary === "chest" && exercise.secondary.includes("calves"));

    const createdState = await storedState(page);
    const custom = createdState.custom.find((exercise) => exercise.name === "Custom Chest Press");
    assert.ok(custom, "The custom exercise should be saved");
    assert.equal(custom.muscleMappingExplicit, true, "A user-assigned map should be marked explicit");
    assert.deepEqual(custom.secondary, ["calves"]);
    await page.click("button-save-routine");
    await waitFor("custom mapping routine saved", async () => {
      const state = await storedState(page);
      return state.clients[0]?.routines.find((routine) => routine.name === "Custom mapping regression");
    });
    const savedRoutine = (await storedState(page)).clients[0].routines.find(
      (routine) => routine.name === "Custom mapping regression",
    );
    assert.ok(savedRoutine?.exerciseIds.includes(custom.id), "The new custom exercise should be part of its saved routine");
    await page.click(`button-start-routine-${savedRoutine.id}`);
    await waitFor("custom exercise workout logger", () => page.evaluate(
      'document.querySelector(\'[data-testid="text-current-exercise"]\')?.textContent',
    ), (name) => name === "Custom Chest Press");
    await page.fill("input-set-weight", "40");
    await page.fill("input-set-reps", "8");
    await page.click("button-log-set");
    await waitFor("custom exercise work set", () => page.evaluate(
      'document.querySelector(\'[data-testid="list-current-sets"]\')?.textContent',
    ), (text) => text?.includes("40 kg × 8"));
    await page.click("button-finish-session");
    await waitFor("saved custom exercise workout", async () => {
      const state = await storedState(page);
      return state.clients[0]?.sessions.at(-1)?.exercises.some((exercise) => exercise.id === custom.id);
    });
    await navigate(page, `${baseUrl}/clients/${fixtureClient.id}?tab=muscles`, "dashboard-muscle-activity");
    await assertOnlyMappedPanels("chest", "calves", custom.id, "Created custom mapping");

    await reloadAndWait(page, "reloaded custom exercise contributor panels", "dashboard-muscle-activity");
    await assertOnlyMappedPanels("chest", "calves", custom.id, "Created mapping after reload");

    await navigate(page, `${baseUrl}/clients/${fixtureClient.id}`, "button-edit-routine-" + savedRoutine.id);
    await page.click("button-edit-routine-" + savedRoutine.id);
    await waitFor("edit custom mapping routine", () => page.evaluate(
      '!!document.querySelector(\'[data-testid="section-custom-exercise"]\')',
    ));
    await page.click("button-expand-custom-exercise");
    await page.fill("select-custom-exercise-edit", custom.id);
    await page.fill("select-custom-primary-muscle", "quadriceps");
    await page.click("checkbox-custom-secondary-calves");
    await page.click("checkbox-custom-secondary-hamstrings");
    await page.click("button-save-custom-mapping");
    await waitFor("updated custom muscle mapping", async () => {
      const state = await storedState(page);
      const exercise = state.custom.find((item) => item.id === custom.id);
      return exercise?.primary === "quadriceps" && exercise.secondary.includes("hamstrings");
    });
    assert.equal((await storedState(page)).custom.find((item) => item.id === custom.id)?.muscleMappingExplicit, true);
    await page.click("button-cancel-routine");
    await navigate(page, `${baseUrl}/clients/${fixtureClient.id}?tab=muscles`, "dashboard-muscle-activity");
    await assertOnlyMappedPanels("quadriceps", "hamstrings", custom.id, "Edited custom mapping");

    await reloadAndWait(page, "reloaded edited custom mapping panels", "dashboard-muscle-activity");
    await assertOnlyMappedPanels("quadriceps", "hamstrings", custom.id, "Edited mapping after reload");
    const persisted = await storedState(page);
    assert.deepEqual(
      persisted.custom.find((item) => item.id === custom.id),
      { ...custom, primary: "quadriceps", secondary: ["hamstrings"], muscleMappingExplicit: true },
      "The edited muscle assignment should remain saved after reload",
    );
  } finally {
    await page.evaluate(`localStorage.setItem("setstack-v1", ${JSON.stringify(originalStorage)})`);
    await navigate(page, `${baseUrl}/`, "dashboard-columns");
  }
}

async function verifyFirstLaunchIntro(page, baseUrl) {
  await navigate(page, `${baseUrl}/`, "first-launch-intro");
  const splash = await page.evaluate(`({
    skipVisible: !!document.querySelector('[data-testid="button-intro-skip"]'),
    markAnimation: getComputedStyle(document.querySelector(".intro-mark")).animationName,
    wordmarkAnimation: getComputedStyle(document.querySelector('[data-testid="intro-wordmark"]')).animationName
  })`);
  assert.equal(splash.skipVisible, true, "Skip must be available during the opening animation");
  assert.equal(splash.markAnimation, "coachaura-intro-scale");
  assert.equal(splash.wordmarkAnimation, "coachaura-intro-wordmark");

  const animationStarted = Date.now();
  await waitFor("welcome screen after opening animation", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="intro-welcome"]\')',
  ));
  const animationDuration = Date.now() - animationStarted;
  assert.ok(animationDuration >= 2200 && animationDuration < 6000, `The opening transition should take about 2–3 seconds (observed ${animationDuration}ms)`);
  const welcome = await page.evaluate(`({
    headline: document.querySelector('[data-testid="intro-welcome"] h1')?.innerText.replace(/\\s+/g, " ").trim(),
    supporting: document.querySelector('[data-testid="intro-welcome"] p')?.textContent.trim()
  })`);
  assert.equal(welcome.headline, "Your clients. Your data. No subscriptions.");
  assert.equal(welcome.supporting, "CoachAura");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="intro-welcome"]\')?.textContent.includes("Track workouts, manage clients and monitor progress — all in one streamlined app.")',
  ), true);

  await page.click("button-intro-get-started");
  await waitFor("app after Get Started", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="dashboard-columns"]\')',
  ));
  assert.equal(await page.evaluate(
    'localStorage.getItem("coachaura-intro-complete-v1")',
  ), "1", "Get Started should persist completion locally");
  assert.equal(await page.evaluate(
    '!!document.querySelector(\'[data-testid="first-launch-intro"]\')',
  ), false);
  await reloadAndWait(page, "subsequent launch after Get Started", "dashboard-columns");

  await page.evaluate(`(() => {
    localStorage.removeItem("coachaura-intro-complete-v1");
    localStorage.removeItem("setstack-v1");
  })()`);
  await navigate(page, `${baseUrl}/`, "button-intro-skip");
  await page.click("button-intro-skip");
  await waitFor("app after Skip", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="dashboard-columns"]\')',
  ));
  assert.equal(await page.evaluate(
    'localStorage.getItem("coachaura-intro-complete-v1")',
  ), "1", "Skip should persist completion locally");
  await reloadAndWait(page, "subsequent launch after Skip", "dashboard-columns");
}

async function verifyPolishedEmptyStates(page, baseUrl, fixtureClients) {
  const originalStorage = await page.evaluate('localStorage.getItem("setstack-v1")');
  assert.ok(originalStorage, "The isolated browser should contain its seeded test state");
  const replaceStorage = async (value) => page.evaluate(
    `localStorage.setItem("setstack-v1", ${JSON.stringify(JSON.stringify(value))})`,
  );

  try {
    const noClientsStore = JSON.parse(originalStorage);
    noClientsStore.state.clients = [];
    await replaceStorage(noClientsStore);
    await navigate(page, `${baseUrl}/`, "empty-client-list");
    const dashboardEmpty = await page.evaluate(`({
      heading: document.querySelector('[data-testid="empty-client-list"] h3')?.textContent.trim(),
      description: document.querySelector('[data-testid="empty-client-list"] p')?.textContent.trim(),
      addClientButtons: document.querySelectorAll('[data-testid="button-add-client"]').length,
      nextWorkout: !!document.querySelector('[data-testid="card-next-workout"]')
    })`);
    assert.equal(dashboardEmpty.heading, "Build your client list");
    assert.equal(dashboardEmpty.description, "Add your first client to start tracking workouts and progress.");
    assert.equal(dashboardEmpty.addClientButtons, 1, "The empty dashboard should expose one Add client action");
    assert.equal(dashboardEmpty.nextWorkout, false, "A no-client dashboard should not show a redundant workout prompt");
    await page.click("button-add-client");
    await waitFor("add-client form from dashboard empty state", () => page.evaluate(
      '!!document.querySelector(\'[data-testid="button-save-client"]\')',
    ));

    const emptyClient = structuredClone(fixtureClients[0]);
    emptyClient.sessions = [];
    emptyClient.routines = [];
    emptyClient.weeklyPlan = {};
    emptyClient.bodyweight = [];
    const noHistoryStore = JSON.parse(originalStorage);
    noHistoryStore.state.clients = [emptyClient];
    noHistoryStore.state.draft = null;
    await replaceStorage(noHistoryStore);
    await navigate(page, `${baseUrl}/clients/${emptyClient.id}`, "empty-weekly-plan");
    assert.equal(await page.evaluate(
      'document.querySelector("[data-testid=\\"empty-weekly-plan\\"] h3")?.textContent.trim()',
    ), "No workouts scheduled");
    assert.equal(await page.evaluate(
      'document.querySelector("[data-testid=\\"button-empty-create-routine\\"]")?.textContent.includes("Create workout")',
    ), true, "The no-schedule action should open the existing routine editor");
    assert.equal(await page.evaluate(
      'document.querySelectorAll("[data-testid=\\"button-empty-create-routine\\"], [data-testid=\\"button-new-routine\\"]").length',
    ), 1, "The no-routine profile should not show duplicate create actions");
    assert.equal(await page.evaluate(
      'document.querySelector("[data-testid=\\"empty-bodyweight\\"] p")?.textContent.trim()',
    ), "Track your starting point");

    await page.click("tab-records");
    await waitFor("empty personal-record state", () => page.evaluate(
      '!!document.querySelector(\'[data-testid="empty-personal-records"]\')',
    ));
    assert.equal(await page.evaluate(
      'document.querySelector("[data-testid=\\"empty-personal-records\\"] p")?.textContent.trim()',
    ), "No records yet");
    await page.click("tab-history");
    await waitFor("empty workout-history state", () => page.evaluate(
      '!!document.querySelector(\'[data-testid="empty-workout-history"]\')',
    ));
    assert.equal(await page.evaluate(
      'document.querySelector("[data-testid=\\"empty-workout-history\\"] p")?.textContent.trim()',
    ), "Progress starts here");
    await page.click("tab-muscles");
    await waitFor("empty muscle analytics state", () => page.evaluate(
      '!!document.querySelector(\'[data-testid="empty-muscle-history"]\')',
    ));

    await page.click("tab-overview");
    await page.click("button-empty-create-routine");
    await waitFor("empty routine builder state", () => page.evaluate(
      '!!document.querySelector(\'[data-testid="empty-routine-exercises"]\')',
    ));
    assert.equal(await page.evaluate(
      'document.querySelector("[data-testid=\\"empty-routine-exercises\\"] p")?.textContent.trim()',
    ), "Start building your workout");
    await page.click("button-cancel-routine");

    await page.click("button-client-start-session");
    await waitFor("empty live workout state", () => page.evaluate(
      '!!document.querySelector(\'[data-testid="empty-live-workout"]\')',
    ));
    assert.equal(await page.evaluate(
      'document.querySelectorAll("[data-testid=\\"button-logger-add-exercise\\"]").length',
    ), 1, "A blank live workout should show only one Add exercise action");
    await page.click("button-logger-add-exercise");
    await waitFor("exercise library from live empty state", () => page.evaluate(
      '!!document.querySelector(\'[data-testid="input-logger-exercise"]\')',
    ));
    await page.click("button-logger-add-exercise");
    await page.click("button-minimize-session");
    await waitFor("minimized blank workout", () => page.evaluate(
      'document.querySelector(\'[data-testid="panel-workout-logger"]\') === null',
    ));

    await page.fill("input-bodyweight", "71.2");
    await page.click("button-add-bodyweight");
    const recordedState = await storedState(page);
    assert.equal(recordedState.clients[0].bodyweight.length, 1, "The existing measurement action should save a real measurement");
    assert.equal(await page.evaluate(
      '!!document.querySelector(\'[data-testid="empty-bodyweight"]\')',
    ), false, "The measurement empty state should disappear once data exists");
    assert.deepEqual(
      recordedState.clients[0].sessions,
      [],
      "Opening the routine builder, exercise picker and rest of the empty workflow must not create workout history",
    );
  } finally {
    await page.evaluate(`localStorage.setItem("setstack-v1", ${JSON.stringify(originalStorage)})`);
    await navigate(page, `${baseUrl}/`, "dashboard-columns");
  }
}

async function finishWorkoutWithFailedSave(page, baseUrl, debugPort) {
  const chartPage = await openPage(debugPort);
  try {
    const beforeChart = await muscleChartSnapshot(chartPage, baseUrl, clientId, "chest", 7);
    await navigate(page, `${baseUrl}/clients/${clientId}`, "button-client-start-session");
    const before = await storedState(page);
    const clientBefore = before.clients.find((client) => client.id === clientId);
    const sessionsBefore = clientBefore.sessions.length;
    await page.click("button-client-start-session");
    await waitFor("workout logger for failed-finish scenario", () => page.evaluate(
      '!!document.querySelector(\'[data-testid="panel-workout-logger"]\')',
    ));

    const expectedSets = [
      { weight: 52.5, reps: 9, rir: 3 },
      { weight: 57.5, reps: 7, rir: 1 },
    ];
    for (const item of expectedSets) {
      const displayWeight = String(Number(toDisplay(item.weight, before.unit).toFixed(2)));
      await page.fill("input-set-weight", displayWeight);
      await page.fill("input-set-reps", String(item.reps));
      await page.fill("input-set-rir", String(item.rir));
      await page.click("button-log-set");
    }
    const expectedSetTexts = expectedSets.map((item) => {
      const displayWeight = String(Number(toDisplay(item.weight, before.unit).toFixed(2)));
      return `${formatLoad(fromDisplay(Number(displayWeight), before.unit), before.unit)} × ${item.reps}`;
    });
    await waitFor("set logged before finish", () => page.evaluate(
      'document.querySelector(\'[data-testid="list-current-sets"]\')?.textContent',
    ), (text) => expectedSetTexts.every((expected) => text?.includes(expected)));

    const pending = await storedState(page);
    const draftBeforeFinish = structuredClone(pending.draft);
    const rawBeforeFinish = await page.evaluate('localStorage.getItem("setstack-v1")');
    assert.ok(draftBeforeFinish?.exercises.some((exercise) =>
      expectedSets.every((expected) => exercise.sets.some((set) => set.reps === expected.reps))),
    "The workout draft should include every logged set before finishing");
    await page.evaluate(`(() => {
      window.__coachauraFailNextSetstackWrite = true;
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) {
        if (key === "setstack-v1" && window.__coachauraFailNextSetstackWrite) {
          window.__coachauraFailNextSetstackWrite = false;
          throw new DOMException("Simulated storage write failure", "QuotaExceededError");
        }
        return originalSetItem.call(this, key, value);
      };
    })()`);
    await page.click("button-finish-session");
    await waitFor("failed workout-finish write warning", () => page.evaluate(
      'document.querySelector(\'[data-testid="button-retry-storage"]\') !== null',
    ));

    assert.equal(await page.evaluate(
      '!!document.querySelector(\'[data-testid="panel-workout-logger"]\')',
    ), true, "The live workout logger should remain available after a failed final save");
    const visibleSets = await page.evaluate(
      'document.querySelector(\'[data-testid="list-current-sets"]\')?.textContent',
    );
    assert.ok(expectedSetTexts.every((expected) => visibleSets?.includes(expected)),
      "All entered loads and reps should remain visible in the active workout");
    assert.equal(await page.evaluate('localStorage.getItem("setstack-v1")'), rawBeforeFinish,
      "A failed finish must leave saved data byte-for-byte unchanged");
    const afterFailure = await storedState(page);
    assert.deepEqual(afterFailure.draft, draftBeforeFinish, "The active workout and its entered values must remain unchanged");
    assert.equal(afterFailure.clients.find((client) => client.id === clientId).sessions.length, sessionsBefore,
      "A failed finish must not append a workout to saved history");
    await reloadAndWait(chartPage, "charts reloaded after rejected final save", "dashboard-muscle-activity");
    assert.deepEqual(await muscleChartSnapshot(chartPage, baseUrl, clientId, "chest", 7), beforeChart,
      "A failed finish must leave the client's saved muscle charts unchanged");

    await page.click("button-retry-storage");
    await waitFor("recovered workout-finish storage", () => page.evaluate(
      'document.querySelector(\'[data-testid="button-retry-storage"]\') === null',
    ));
    assert.equal(await page.evaluate(
      '!!document.querySelector(\'[data-testid="panel-workout-logger"]\')',
    ), true, "Checking storage must not close the active workout");
    await page.click("button-finish-session");
    await waitFor("retried workout finish", () => page.evaluate(
      'document.querySelector(\'[data-testid="panel-workout-logger"]\') === null',
    ));

    const completed = await storedState(page);
    const clientCompleted = completed.clients.find((client) => client.id === clientId);
    assert.equal(clientCompleted.sessions.length, sessionsBefore + 1,
      "Retrying the finish should add exactly one completed workout");
    const saved = clientCompleted.sessions.at(-1);
    const exerciseWithSets = draftBeforeFinish.exercises.find((exercise) => exercise.sets.length > 0);
    const savedExercise = saved.exercises.find((exercise) => exercise.id === exerciseWithSets.id);
    assert.deepEqual(savedExercise?.sets, exerciseWithSets.sets,
      "The retried workout should preserve the IDs and exact values of every logged set");

    await reloadAndWait(page, "retried completed workout after reload", "button-client-start-session");
    const reloaded = await storedState(page);
    const reloadedClient = reloaded.clients.find((client) => client.id === clientId);
    assert.equal(reloadedClient.sessions.length, sessionsBefore + 1,
      "Reloading should still show exactly one completed workout from the retry");
    assert.equal(reloadedClient.sessions.at(-1).id, saved.id,
      "The same completed workout should remain saved after reload");
  } finally {
    await chartPage.close();
  }
}

test("profile charts, workout logging, numeric inputs, and rest timer work across CoachAura themes", { timeout: 480000 }, async (t) => {
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
  await verifyFirstLaunchIntro(page, baseUrl);
  await page.evaluate(`(() => {
    localStorage.removeItem("coachaura-intro-complete-v1");
    localStorage.setItem("setstack-v1", ${JSON.stringify(fixture)});
  })()`);
  await navigate(page, `${baseUrl}/`, "dashboard-columns");
  assert.equal(await page.evaluate(
    '!!document.querySelector(\'[data-testid="first-launch-intro"]\')',
  ), false, "A stored workspace from an older installation must bypass onboarding");
  assert.deepEqual((await storedState(page)).clients, initialClients, "Existing client data must remain unchanged when skipping onboarding on an update");
  const dashboardContent = await page.evaluate(`({
    hasRecentActivity: Array.from(document.querySelectorAll("h2"))
      .some((heading) => heading.textContent.trim() === "Recent activity"),
    activityRows: document.querySelectorAll('[data-testid^="link-activity-"]').length,
    clientRows: document.querySelectorAll('[data-testid^="link-client-seed-"]').length,
    quickStart: !!document.querySelector('[data-testid="button-open-quick-start"]'),
    overviewStats: !!document.querySelector('[data-testid="overview-stats"]')
  })`);
  assert.equal(dashboardContent.hasRecentActivity, false, "The dashboard should not render the Recent Activity section");
  assert.equal(dashboardContent.activityRows, 0, "Recent activity rows should be removed from the dashboard");
  assert.equal(dashboardContent.clientRows, initialClients.length, "Client shortcuts must remain visible");
  assert.ok(dashboardContent.quickStart, "Quick workout actions must remain available");
  assert.ok(dashboardContent.overviewStats, "Dashboard overview statistics must remain available");
  await verifyPolishedEmptyStates(page, baseUrl, initialClients);
  t.diagnostic("No-client, no-schedule, no-routine, no-exercise, no-history, no-record, and no-measurement states guide existing actions without duplicating them");
  await navigate(page, `${baseUrl}/clients/${clientId}`, "button-client-start-session");

  for (let index = 0; index < appearances.length; index += 1) {
    const appearance = appearances[index];
    await assertAppearance(page, appearance);
    await verifyExerciseIllustrations(page, baseUrl, appearance);
    t.diagnostic(`Exercise maps: all 18 primary muscle groups, ${appearance}, reduced motion, offline search, neutral fallback and routine selection`);
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
  await finishWorkoutWithFailedSave(page, baseUrl, debugPort);
  t.diagnostic("Failed final workout saves preserve the active workout and charts; storage recovery and retry save one workout after reload");
  await cancelSavedSetCorrectionAndVerifyUnchanged(page, baseUrl);
  t.diagnostic("Cancelling saved-set edits leaves client history and muscle charts unchanged");
  await renameSavedWorkoutAndVerifyCharts(page, baseUrl);
  t.diagnostic("Renaming a saved workout changes only its history label and leaves muscle charts unchanged after reload");
  await rejectImpossibleSavedWorkoutDateAndVerifyUnchanged(page, baseUrl);
  t.diagnostic("Impossible saved-workout dates are rejected without changing history, while valid dates still save");
  await rejectEmptySavedWorkoutAndVerifyUnchanged(page, baseUrl);
  t.diagnostic("Saving a workout with every set removed is rejected; cancelling preserves history and charts");
  await addSavedSetAndVerifyCharts(page, baseUrl, initialClients, debugPort);
  t.diagnostic("Failed added-set saves preserve editor values and charts; retry and reload persist the set");
  await rejectInvalidSavedLoadsAndVerifyUnchanged(page, baseUrl);
  t.diagnostic("Negative and non-finite saved-load corrections are rejected without changing storage or muscle charts");
  await enforceSavedLoadCeilingAndVerifyStrengthHistory(page, baseUrl);
  t.diagnostic("The accepted saved-load ceiling produces finite strength history, while oversized finite loads are visibly rejected before and after reload");
  await correctSavedLoadAndVerifyStrengthHistory(page, baseUrl);
  t.diagnostic("A valid saved-load correction updates strength history while chest and triceps set counts stay stable after reload");
  await verifyWarmupOnlyWorkoutHasNoStrengthRecords(page, baseUrl);
  t.diagnostic("Editing a saved workout to warm-up-only keeps it in history without adding strength history or personal records");
  await rejectInvalidSavedRepsAndVerifyUnchanged(page, baseUrl);
  t.diagnostic("Zero, fractional, and over-limit saved-rep corrections are rejected without changing storage or muscle charts");
  await rejectInvalidSavedEffortAndVerifyUnchanged(page, baseUrl);
  t.diagnostic("Out-of-range and non-finite RIR corrections are rejected without changing storage or charts");
  await correctSavedSetsAndVerifyCharts(page, baseUrl);
  t.diagnostic("Saved-set corrections verified; checking seven-day and 30-day date boundaries");
  await correctSharedMuscleContributorsAndVerifyCharts(page, baseUrl);
  t.diagnostic("Shared-muscle exercise rows retain independent set and effort contributions across edits and reloads");
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
  await correctSavedEffortAndVerifyCharts(page, baseUrl);
  t.diagnostic("Effort corrections update the recovery estimate from the latest valid exposure and persist after reload");
  const customMappingClient = structuredClone(initialClients.find((item) => item.id === "seed-amina"));
  customMappingClient.id = "test-custom-exercise-mappings";
  customMappingClient.name = "Custom exercise mapping fixture";
  customMappingClient.sessions = [];
  customMappingClient.routines = [];
  customMappingClient.weeklyPlan = {};
  await verifyCustomExerciseMuscleContributors(page, baseUrl, customMappingClient);
  t.diagnostic("Custom exercise creation, edits, exact primary/secondary contributor panels, and reload persistence verified");

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
    strength: document.querySelector('[data-testid="card-client-strength-trend"]')?.textContent.includes("Progress starts here"),
    weeklyTotal: document.querySelector('[data-testid="card-client-weekly-sets"] [aria-label$="working sets this week"]')?.textContent
  })`);
  assert.equal(emptyOverview.strength, true, "The strength card should not invent a performance history");
  assert.equal(emptyOverview.weeklyTotal, "0 sets", "The empty client should show zero recorded working sets");
  await navigate(page, `${baseUrl}/clients/${clientId}`, "button-client-start-session");
  const emptyAchievement = await page.evaluate(`({
    count: document.querySelector('[data-testid="achievement-count"]')?.textContent,
    firstWorkout: document.querySelector('[data-testid="achievement-badge-first-workout"]')?.getAttribute("aria-label")
  })`);
  assert.match(emptyAchievement.count ?? "", /^\d+ \/ 15 earned$/, "Empty workout history should still render the gallery without an error");
  assert.match(emptyAchievement.firstWorkout ?? "", /locked/, "A client with no saved workouts must not receive a workout achievement");

  const clientsBeforeIndividual = (await storedState(page)).clients;
  await navigate(page, `${baseUrl}/settings`, "button-training-mode-individual");
  await page.click("button-training-mode-individual");
  await navigate(page, `${baseUrl}/`, "individual-bottom-navigation");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="tab-individual-progress"]\')?.getAttribute("aria-pressed")',
  ), "true", "Progress should be the default Individual Mode tab");
  await page.click("button-individual-range-7");
  await page.click("tab-individual-exercises");
  await waitFor("individual exercise library tab", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="tab-individual-exercises-library"]\')',
  ));
  await page.click("tab-individual-exercises-library");
  assert.ok(await page.evaluate(
    'document.querySelector(\'[data-testid="individual-exercises-screen"] input[data-testid="input-search-library"]\') !== null',
  ), "Exercises should show the existing searchable exercise library");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="tab-individual-exercises"]\')?.getAttribute("aria-pressed")',
  ), "true", "The selected Exercises tab should be announced and highlighted");
  await page.click("tab-individual-profile");
  assert.ok(await page.evaluate(
    'document.querySelector(\'[data-testid="individual-profile-preferences"]\') !== null',
  ), "Profile should show personal training preferences");
  await page.click("tab-individual-progress");
  assert.equal(await page.evaluate(
    'document.querySelector(\'[data-testid="button-individual-range-7"]\')?.getAttribute("aria-pressed")',
  ), "true", "Progress state should remain when switching between tabs");
  const stateBeforePersonalWorkout = await storedState(page);
  await page.click("tab-individual-exercises");
  const exerciseId = kExercises[0].id;
  const secondExerciseId = kExercises[1].id;
  await waitFor("personal workout planner tabs", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="tab-individual-exercises-library"]\')',
  ));
  await page.click("tab-individual-exercises-library");
  await page.click(`button-select-library-exercise-${exerciseId}`);
  await page.fill("input-new-plan-name", "TEST Push Day");
  await page.click("button-create-plan-with-exercise");
  await waitFor("new personal plan", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="list-individual-plans"]\')',
  ));
  let personalPlanState = await storedState(page);
  let personalPlan = personalPlanState.individualProfile.plans.at(-1);
  assert.equal(personalPlan.name, "TEST Push Day");
  assert.deepEqual(personalPlan.exerciseIds, [exerciseId], "Creating a plan from the library includes the selected exercise");

  await page.click("tab-individual-exercises-library");
  await page.click(`button-select-library-exercise-${secondExerciseId}`);
  await page.click(`button-add-exercise-to-plan-${personalPlan.id}`);
  personalPlanState = await storedState(page);
  personalPlan = personalPlanState.individualProfile.plans.find((plan) => plan.id === personalPlan.id);
  assert.deepEqual(personalPlan.exerciseIds, [exerciseId, secondExerciseId], "A selected exercise is appended to the existing plan");

  await page.click("tab-individual-exercises-library");
  await page.click(`button-select-library-exercise-${secondExerciseId}`);
  assert.equal(await page.evaluate(`document.querySelector('[data-testid="button-add-exercise-to-plan-${personalPlan.id}"]')?.disabled`), true, "Duplicate exercises cannot be added accidentally");
  await page.click("button-close-dialog");
  await page.click("tab-individual-exercises-plans");
  await page.click(`button-edit-individual-plan-${personalPlan.id}`);
  await waitFor("personal plan editor", () => page.evaluate(
    `!!document.querySelector('[data-testid="button-toggle-targets-${secondExerciseId}"]')`,
  ));
  await page.click(`button-toggle-targets-${secondExerciseId}`);
  await page.click(`button-move-exercise-up-${secondExerciseId}`);
  await page.fill("input-routine-name", "TEST Upper Day");
  await page.click("button-save-routine");
  personalPlanState = await storedState(page);
  personalPlan = personalPlanState.individualProfile.plans.find((plan) => plan.id === personalPlan.id);
  assert.equal(personalPlan.name, "TEST Upper Day", "Plan names can be edited");
  assert.deepEqual(personalPlan.exerciseIds, [secondExerciseId, exerciseId], "Exercise order can be changed and saved");
  assert.deepEqual(personalPlanState.clients, stateBeforePersonalWorkout.clients, "Plans remain separate from trainer client records");

  await reloadAndWait(page, "Individual Mode after reload", "individual-bottom-navigation");
  await page.click("tab-individual-exercises");
  await waitFor("personal plans after reload", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="tab-individual-exercises-plans"]\')',
  ));
  await page.click("tab-individual-exercises-plans");
  const reloadedPlan = (await storedState(page)).individualProfile.plans.find((plan) => plan.id === personalPlan.id);
  assert.deepEqual(reloadedPlan.exerciseIds, [secondExerciseId, exerciseId], "Plans and their order survive app reloads");

  await page.click(`button-start-individual-plan-${personalPlan.id}`);
  await waitFor("personal workout logger", () => page.evaluate(
    '!!document.querySelector(\'[data-testid="panel-workout-logger"]\')',
  ));
  const personalDraftState = await storedState(page);
  assert.equal(personalDraftState.draft?.clientId, INDIVIDUAL_PROFILE_ID, "Plan workouts use the separate personal owner");
  assert.equal(personalDraftState.draft?.routineId, personalPlan.id);
  assert.deepEqual(personalDraftState.draft?.exercises.map((exercise) => exercise.id), [secondExerciseId, exerciseId], "Starting a plan preloads its saved exercise order");
  await page.fill("input-set-weight", "60");
  await page.fill("input-set-reps", "8");
  await page.click("button-log-set");
  await page.click("button-finish-session");
  const completedPersonalState = await storedState(page);
  assert.equal(completedPersonalState.draft, null, "Finishing the logger clears only the active draft");
  assert.equal(completedPersonalState.individualProfile.sessions.length, 1, "Completed plan workouts appear in personal history");
  assert.deepEqual(completedPersonalState.individualProfile.plans.find((plan) => plan.id === personalPlan.id).exerciseIds, [secondExerciseId, exerciseId], "Live workout edits do not mutate the saved plan");
  assert.deepEqual(completedPersonalState.clients, clientsBeforeIndividual, "Personal workout logging must not modify trainer client records");

  await page.click("tab-individual-exercises");
  await page.click("tab-individual-exercises-plans");
  await page.click(`button-delete-individual-plan-${personalPlan.id}`);
  await page.click("button-confirm-delete-individual-plan");
  const afterPlanDelete = await storedState(page);
  assert.equal(afterPlanDelete.individualProfile.plans.length, 0, "A plan can be deleted");
  assert.equal(afterPlanDelete.individualProfile.sessions.length, 1, "Deleting a plan leaves completed workout history intact");
  assert.deepEqual(afterPlanDelete.clients, clientsBeforeIndividual, "Plan changes never affect trainer-managed clients");
});
