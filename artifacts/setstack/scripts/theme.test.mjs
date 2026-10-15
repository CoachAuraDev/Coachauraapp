import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");

function tokens(selector) {
  const result = {};
  for (const [, selectors, body] of read("src/index.css").matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const actual = selectors.replace(/\/\*[\s\S]*?\*\//g, "").split(",").map((entry) => entry.trim());
    if (!actual.includes(selector)) continue;
    for (const [, name, value] of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) result[name] = value.trim();
  }
  return result;
}

function rgb(hsl) {
  const [h, s, l] = hsl.replaceAll("%", "").split(/\s+/).map(Number);
  assert.ok([h, s, l].every(Number.isFinite), `Invalid HSL: ${hsl}`);
  const saturation = s / 100;
  const lightness = l / 100;
  const a = saturation * Math.min(lightness, 1 - lightness);
  return [0, 8, 4].map((n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  });
}

function hex(hsl) {
  return `#${rgb(hsl).map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function contrast(a, b) {
  function luminance(hsl) {
    const [r, g, blue] = rgb(hsl).map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * blue;
  }
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("root and dark classes use the requested exact CoachAura palette", () => {
  const expected = {
    "--background": "#0B0B0D", "--card": "#17171B", "--muted": "#222228",
    "--foreground": "#F5F5F7", "--muted-foreground": "#A1A1AA",
    "--border": "#303036", "--primary": "#B7F34A",
  };
  for (const selector of [":root", ".dark"]) {
    const theme = tokens(selector);
    for (const [name, value] of Object.entries(expected)) {
      assert.equal(hex(theme[name]), value, `${selector} ${name}`);
    }
    assert.notEqual(hex(theme["--chart-1"]), hex(theme["--chart-2"]), "Planned and logged activity must stay distinct");
  }
  assert.equal(tokens(":root")["--status-on-floor-background"], "hsl(84 80% 62% / .14)");
  assert.equal(tokens(":root")["--status-on-floor-foreground"], "hsl(84 80% 70%)");
});

test("key text combinations meet WCAG AA normal-text contrast", () => {
  const theme = tokens(":root");
  for (const [foreground, background] of [
    ["--foreground", "--background"], ["--foreground", "--card"],
    ["--muted-foreground", "--card"], ["--muted-foreground", "--muted"],
    ["--primary-foreground", "--primary"],
    ["--destructive-foreground", "--destructive"],
  ]) {
    assert.ok(contrast(theme[foreground], theme[background]) >= 4.5, `${foreground} on ${background}`);
  }
});

test("both optional orange palettes retain readable tokens and keep the default palette separate", () => {
  const charcoal = tokens(':root[data-appearance="orange-charcoal"]');
  const light = tokens(':root[data-appearance="orange-light-grey"]');
  const css = read("src/index.css");
  assert.match(css, /:root\[data-appearance="orange-charcoal"\]\s*\{\s*color-scheme:\s*dark;/);
  assert.match(css, /:root\[data-appearance="orange-light-grey"\]\s*\{\s*color-scheme:\s*light;/);
  assert.equal(charcoal["--primary"], charcoal["--chart-1"]);
  assert.equal(light["--primary"], light["--chart-1"]);
  assert.notEqual(charcoal["--primary"], tokens(":root")["--primary"]);
  assert.notEqual(light["--background"], tokens(":root")["--background"]);
  for (const theme of [charcoal, light]) {
    for (const [foreground, background] of [
      ["--foreground", "--background"], ["--foreground", "--card"],
      ["--muted-foreground", "--card"], ["--primary-foreground", "--primary"],
    ]) {
      assert.ok(contrast(theme[foreground], theme[background]) >= 4.5, `${foreground} on ${background}`);
    }
  }
});

test("startup explicitly opts into dark before JavaScript and native system-theme detection", () => {
  const html = read("index.html");
  assert.match(html, /<html[^>]*class="dark"/);
  assert.match(html, /name="color-scheme" content="dark light"/);
  assert.match(html, /html,body,#root\{background:#0B0B0D;color:#F5F5F7\}/);
  assert.match(html, /localStorage\.getItem\("setstack-v1"\)/);
  assert.match(html, /orange-light-grey/);
  const native = read("capacitor.config.ts");
  assert.equal((native.match(/backgroundColor: "#0B0B0D"/g) ?? []).length, 2);
  assert.match(native, /style: "DARK"/);
  const styles = read("android/app/src/main/res/values/styles.xml");
  assert.doesNotMatch(styles, /Theme\.AppCompat\.(Light|DayNight)/);
  assert.match(styles, /windowSplashScreenBackground">@color\/setstack_background/);
  assert.match(read("android/app/src/main/res/values/colors.xml"), /name="setstack_background">#0B0B0D/);
});

test("Settings exposes all three appearance choices and applies the selected root mode after hydration", () => {
  const app = read("src/App.tsx");
  assert.match(app, /id="appearance-theme"/);
  assert.match(app, /value="orange-charcoal"/);
  assert.match(app, /value="orange-light-grey"/);
  assert.match(app, /setAppearance\(event\.target\.value/);
  assert.match(app, /root\.classList\.toggle\("dark",appearance!=="orange-light-grey"\)/);
});

test("screen transitions do not retain a transformed container around fixed dialogs", () => {
  const css = read("src/index.css");
  const transition = css.match(/\.page-enter\s*\{([^}]+)\}/)?.[1];
  assert.ok(transition);
  assert.doesNotMatch(transition, /transform|both|forwards/);
  const keyframes = css.match(/@keyframes arrive\s*\{[^]*?\n/)?.[0];
  assert.ok(keyframes);
  assert.doesNotMatch(keyframes, /transform/);
});
