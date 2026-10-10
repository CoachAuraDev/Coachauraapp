import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setupAndroidSdk } from "./setup-android-ci.mjs";

function fixture(t, complete = true) {
  const root = mkdtempSync(path.join(tmpdir(), "setstack-TEST-sdk-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const files = ["cmdline-tools/latest/bin/sdkmanager"];
  if (complete) files.push("platforms/android-36/android.jar", "build-tools/36.0.0/aapt2");
  for (const file of files) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), "TEST fixture, not a real SDK");
  }
  return root;
}

test("SDK setup uses existing tools, finite licence input, explicit packages and GitHub paths", (t) => {
  const root = fixture(t);
  const commands = [];
  const env = path.join(root, "github-env");
  const paths = path.join(root, "github-path");
  setupAndroidSdk({
    sdkRoot: root, githubEnvFile: env, githubPathFile: paths,
    runCommand(command, args, options) {
      commands.push({ command, args, options });
      return { status: 0 };
    },
  });
  assert.equal(commands.length, 3);
  assert.equal(commands[1].options.input, "y\n".repeat(200));
  assert.ok(commands[1].args.includes("--licenses"));
  assert.ok(commands[2].args.includes("platforms;android-36"));
  assert.ok(commands[2].args.includes("build-tools;36.0.0"));
  assert.equal(commands[1].command, path.join(root, "cmdline-tools/latest/bin/sdkmanager"));
  assert.ok(readFileSync(env, "utf8").includes(`ANDROID_HOME=${root}`));
  assert.ok(readFileSync(paths, "utf8").includes("platform-tools"));
});

test("a licence failure stops before installing packages or exporting paths", (t) => {
  const root = fixture(t);
  let called = 0;
  assert.throws(() => setupAndroidSdk({
    sdkRoot: root,
    runCommand: () => ({ status: ++called === 2 ? 1 : 0 }),
  }), /accept SDK licences failed: exit 1/);
  assert.equal(called, 2);
});

test("successful command exits do not hide missing SDK files", (t) => {
  const root = fixture(t, false);
  assert.throws(() => setupAndroidSdk({
    sdkRoot: root, runCommand: () => ({ status: 0 }),
  }), /required file is missing/);
});

test("missing SDK configuration reports an actionable error before running commands", () => {
  assert.throws(() => setupAndroidSdk({ sdkRoot: "" }), /ANDROID_HOME/);
});
