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

test("the two supported themes stay dark, use their exact accents, and meet contrast targets", () => {
  const orange = tokens(':root[data-appearance="orange-charcoal"]');
  const original = tokens(":root");
  const css = read("src/index.css");
  assert.match(css, /:root\[data-appearance="orange-charcoal"\]\s*\{\s*color-scheme:\s*dark;/);
  assert.equal(hex(orange["--primary"]), "#E8A87C");
  assert.equal(hex(orange["--chart-1"]), "#E8A87C");
  assert.equal(orange["--muscle-map-highlight"], "#E8A87C");
  assert.equal(hex(original["--primary"]), "#B7F34A");
  assert.equal(hex(original["--background"]), "#0B0B0D");
  assert.equal(hex(orange["--background"]), "#111214");
  assert.doesNotMatch(css, /data-appearance="(?:orange-light-grey|light-lime-charcoal|light-lime-grey)"/);
  for (const theme of [orange, original]) {
    for (const [foreground, background] of [
      ["--foreground", "--background"], ["--foreground", "--card"],
      ["--muted-foreground", "--card"], ["--primary-foreground", "--primary"],
    ]) {
      assert.ok(contrast(theme[foreground], theme[background]) >= 4.5, `${foreground} on ${background}`);
    }
    assert.ok(contrast(theme["--chart-1"], theme["--card"]) >= 3, "chart line on card");
  }
  assert.ok(contrast(orange["--primary-foreground"], orange["--primary"]) >= 4.5,
    "dark button text on the soft orange primary");
});

test("startup explicitly opts into dark before JavaScript and native system-theme detection", () => {
  const html = read("index.html");
  assert.match(html, /<html[^>]*class="dark"/);
  assert.match(html, /name="color-scheme" content="dark light"/);
  assert.match(html, /html,body,#root\{background:#0B0B0D;color:#F5F5F7\}/);
  assert.match(html, /localStorage\.getItem\("setstack-v1"\)/);
  assert.match(html, /supportedAppearances = \["default", "orange-charcoal"\]/);
  assert.doesNotMatch(html, /orange-light-grey|light-lime-charcoal|light-lime-grey/);
  const native = read("capacitor.config.ts");
  assert.equal((native.match(/backgroundColor: "#0B0B0D"/g) ?? []).length, 2);
  assert.match(native, /style: "DARK"/);
  const styles = read("android/app/src/main/res/values/styles.xml");
  assert.doesNotMatch(styles, /Theme\.AppCompat\.(Light|DayNight)/);
  assert.match(styles, /windowSplashScreenBackground">@color\/setstack_background/);
  assert.match(read("android/app/src/main/res/values/colors.xml"), /name="setstack_background">#0B0B0D/);
});

test("Settings exposes exactly two fixed appearance choices and keeps the app dark after hydration", () => {
  const app = read("src/App.tsx");
  const themes = read("src/lib/gymmane/appearance.ts");
  assert.match(app, /id="appearance-theme"/);
  assert.deepEqual([...themes.matchAll(/value: "([^"]+)"/g)].map((match) => match[1]), ["orange-charcoal", "default"]);
  assert.match(app, /APPEARANCE_THEMES\.map/);
  assert.match(app, /backgroundColor:color/);
  assert.match(app, /data-testid=\{`button-appearance-\$\{theme\.value\}`\}/);
  assert.match(app, /setAppearance\(theme\.value\)/);
  assert.match(app, /root\.classList\.add\("dark"\)/);
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
