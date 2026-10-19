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
import { BACKUP_REMINDER_STORAGE_KEY } from "../src/lib/gymmane/backup-reminder.ts";

const appDirectory = fileURLToPath(new URL("../", import.meta.url));

async function availablePort() {
  const server = net.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function waitFor(description, read, predicate = Boolean, timeoutMs = 15000) {
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
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text ?? "Browser expression failed.");
    return response.result.value;
  }

  async click(testId) {
    const clicked = await this.evaluate(`(() => {
      const node = document.querySelector('[data-testid="${testId}"]');
      if (!node) return false;
      node.click();
      return true;
    })()`);
    assert.equal(clicked, true, `Missing clickable element ${testId}`);
  }

  async close() {
    this.socket.close();
  }
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

async function navigate(page, url, selector) {
  let listener;
  let timeout;
  const loaded = new Promise((resolve, reject) => {
    listener = (event) => {
      if (JSON.parse(String(event.data)).method === "Page.domContentEventFired") resolve();
    };
    page.socket.addEventListener("message", listener);
    timeout = setTimeout(() => reject(new Error(`Page did not load: ${url}`)), 15000);
  });
  try {
    await Promise.all([page.send("Page.navigate", { url }), loaded]);
  } finally {
    clearTimeout(timeout);
    page.socket.removeEventListener("message", listener);
  }
  await waitFor(`page content ${selector}`, () => page.evaluate(
    `document.querySelector('[data-testid="${selector}"]') !== null`,
  ));
}

async function reloadAndWait(page, selector) {
  const marker = `__coachaura_backup_reloaded_${Date.now()}`;
  await page.send("Page.addScriptToEvaluateOnNewDocument", { source: `window[${JSON.stringify(marker)}] = true;` });
  let listener;
  let timeout;
  const loaded = new Promise((resolve, reject) => {
    listener = (event) => {
      if (JSON.parse(String(event.data)).method === "Page.domContentEventFired") resolve();
    };
    page.socket.addEventListener("message", listener);
    timeout = setTimeout(() => reject(new Error("Reload did not finish loading.")), 15000);
  });
  try {
    await Promise.all([page.send("Page.reload", { ignoreCache: true }), loaded]);
  } finally {
    clearTimeout(timeout);
    page.socket.removeEventListener("message", listener);
  }
  await waitFor(`reloaded page content ${selector}`, () => page.evaluate(
    `window[${JSON.stringify(marker)}] === true && document.querySelector('[data-testid="${selector}"]') !== null`,
  ));
}

function browserBinary() {
  return process.env.CHROME_BIN ?? "/repl/tools/bin/chromium";
}

test("backup reminder export outcomes persist in an isolated browser profile", { timeout: 90000 }, async (t) => {
  const chrome = browserBinary();
  try {
    await access(chrome);
  } catch {
    assert.fail(`Chromium is required for this UI regression test. Set CHROME_BIN to its executable path (checked ${chrome}).`);
  }

  const appPort = await availablePort();
  const debugPort = await availablePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const profileDirectory = await mkdtemp(path.join(os.tmpdir(), "coachaura-backup-reminder-"));
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
    await rm(profileDirectory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  });

  await waitFor("Vite dev server", async () => {
    try {
      return (await fetch(baseUrl)).ok;
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
      return (await fetch(`http://127.0.0.1:${debugPort}/json/version`)).ok;
    } catch {
      if (browser.exitCode != null) throw new Error(`Chromium exited before startup (${browser.exitCode}).`);
      return false;
    }
  });

  page = await openPage(debugPort);
  const fixture = JSON.stringify({
    state: { clients: seedClients(), unit: "kg", appearance: "default", draft: null, custom: [], templates: [] },
    version: 0,
  });
  await page.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (location.host === "127.0.0.1:${appPort}" && !localStorage.getItem("setstack-v1")) {
      localStorage.setItem("setstack-v1", ${JSON.stringify(fixture)});
    }
    window.__coachauraFailBackupExport = false;
    window.__coachauraClockOffsetMs = Number(sessionStorage.getItem("__coachaura_backup_clock_offset") || 0);
    const originalNow = Date.now.bind(Date);
    Date.now = () => originalNow() + window.__coachauraClockOffsetMs;
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (...args) => {
      if (window.__coachauraFailBackupExport) throw new Error("Simulated backup file creation failure");
      return originalCreateObjectURL(...args);
    };`,
  });
  await navigate(page, `${baseUrl}/`, "backup-reminder");
  const floorBefore = await page.evaluate('localStorage.getItem("setstack-v1")');
  const reminderKey = JSON.stringify(BACKUP_REMINDER_STORAGE_KEY);

  assert.equal(await page.evaluate(`localStorage.getItem(${reminderKey})`), null);
  await page.evaluate("window.__coachauraFailBackupExport = true");
  await page.click("button-backup-now");
  await waitFor("failed backup export", () => page.evaluate(
    'document.querySelector(\'[data-testid="backup-export-error"]\')?.textContent',
  ));
  assert.equal(await page.evaluate(`localStorage.getItem(${reminderKey})`), null, "A failed export must not be recorded");

  await page.evaluate("window.__coachauraFailBackupExport = false");
  await page.click("button-backup-now");
  await waitFor("backup save confirmation", () => page.evaluate(
    'document.querySelector(\'[data-testid="backup-export-confirmation"]\') !== null',
  ));
  await page.click("button-backup-not-saved");
  await waitFor("cancelled backup confirmation", () => page.evaluate(
    'document.querySelector(\'[data-testid="backup-export-confirmation"]\') === null',
  ));
  assert.equal(await page.evaluate(`localStorage.getItem(${reminderKey})`), null, "A not-saved export must not be recorded");
  assert.ok(await page.evaluate('!!document.querySelector(\'[data-testid="backup-reminder"]\')'), "The reminder remains after a cancelled export");

  await navigate(page, `${baseUrl}/settings`, "last-successful-backup");
  assert.equal(await page.evaluate('document.querySelector(\'[data-testid="last-successful-backup"]\').textContent.trim()'),
    "No successful export has been confirmed on this device yet.");
  await navigate(page, `${baseUrl}/`, "backup-reminder");
  await page.click("button-backup-remind-later");
  await waitFor("snoozed reminder", () => page.evaluate(
    'document.querySelector(\'[data-testid="backup-reminder"]\') === null',
  ));
  const snoozed = await page.evaluate(`JSON.parse(localStorage.getItem(${reminderKey}))`);
  assert.equal(snoozed.lastSuccessfulExportAt, null);
  assert.ok(Number.isFinite(snoozed.remindLaterUntil));

  await reloadAndWait(page, "dashboard-columns");
  assert.equal(await page.evaluate('!!document.querySelector(\'[data-testid="backup-reminder"]\')'), false,
    "The reminder snooze must survive a reload");
  await page.evaluate(`(() => {
    const offset = 25 * 60 * 60 * 1000;
    sessionStorage.setItem("__coachaura_backup_clock_offset", String(offset));
    window.__coachauraClockOffsetMs = offset;
  })()`);
  await reloadAndWait(page, "dashboard-columns");
  await waitFor("reminder after snooze expires", () => page.evaluate(
    'document.querySelector(\'[data-testid="backup-reminder"]\') !== null',
  ));

  await page.click("button-backup-now");
  await waitFor("confirmed backup prompt", () => page.evaluate(
    'document.querySelector(\'[data-testid="backup-export-confirmation"]\') !== null',
  ));
  await page.click("button-confirm-backup-saved");
  await waitFor("persisted backup confirmation time", () => page.evaluate(`(() => {
    const raw = localStorage.getItem(${reminderKey});
    return raw ? JSON.parse(raw).lastSuccessfulExportAt : null;
  })()`), (timestamp) => Number.isFinite(timestamp) && timestamp > 0);
  const confirmed = await page.evaluate(`JSON.parse(localStorage.getItem(${reminderKey}))`);
  assert.ok(Number.isFinite(confirmed.lastSuccessfulExportAt) && confirmed.lastSuccessfulExportAt > 0);
  assert.equal(confirmed.remindLaterUntil, null, "A confirmed export clears the snooze");

  await reloadAndWait(page, "dashboard-columns");
  assert.equal(await page.evaluate('!!document.querySelector(\'[data-testid="backup-reminder"]\')'), false,
    "A confirmed backup must clear the dashboard reminder after reload");
  await navigate(page, `${baseUrl}/settings`, "last-successful-backup");
  const settingsStatus = await page.evaluate(`(() => {
    const status = document.querySelector('[data-testid="last-successful-backup"]').textContent.trim();
    return { status, expected: "Last successful export: " + new Date(${confirmed.lastSuccessfulExportAt}).toLocaleString() };
  })()`);
  assert.equal(settingsStatus.status, settingsStatus.expected, "Settings shows the saved confirmation timestamp");
  await reloadAndWait(page, "last-successful-backup");
  assert.equal(await page.evaluate('document.querySelector(\'[data-testid="last-successful-backup"]\').textContent.trim()'),
    settingsStatus.expected, "The Settings timestamp persists after reload");
  assert.equal(await page.evaluate('localStorage.getItem("setstack-v1")'), floorBefore,
    "The isolated reminder flow must not alter the workout and client records");
  t.diagnostic("Failed, not-saved, snoozed, and explicitly confirmed backup exports verified across reloads.");
});
