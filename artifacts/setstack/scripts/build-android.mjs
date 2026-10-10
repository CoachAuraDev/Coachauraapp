import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const vite = path.join(path.dirname(require.resolve("vite/package.json")), "bin/vite.js");
const result = spawnSync(process.execPath, [vite, "build", "--config", "vite.config.ts"], {
  cwd: root,
  stdio: "inherit",
  // Android serves its bundled app from https://localhost/, not an artifact prefix.
  env: { ...process.env, NODE_ENV: "production", PORT: "23502", BASE_PATH: "/" },
});
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const legal = path.join(root, "dist/public/legal");
mkdirSync(legal, { recursive: true });
copyFileSync(path.join(root, "LICENSE"), path.join(legal, "SetStack-GPL-3.0.txt"));
copyFileSync(path.join(root, "third_party/gymmane/NOTICE"), path.join(legal, "GymMane-NOTICE.txt"));
copyFileSync(path.join(root, "docs/android-third-party-notices.md"), path.join(legal, "Android-third-party-notices.txt"));
for (const name of ["core", "android", "app", "filesystem", "share"]) {
  const packageRoot = path.dirname(require.resolve(`@capacitor/${name}/package.json`));
  copyFileSync(path.join(packageRoot, "LICENSE"), path.join(legal, `Capacitor-${name}-LICENSE.txt`));
}
console.info("Android web bundle prepared at artifacts/setstack/dist/public (including licence notices).");
