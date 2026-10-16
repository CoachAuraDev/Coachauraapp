export const APPEARANCE_THEMES = [
  {
    value: "default",
    label: "Original Lime Green",
    mode: "Dark",
    swatches: ["#0B0B0D", "#17171B", "#B7F34A"],
  },
  {
    value: "orange-charcoal",
    label: "Peach Theme",
    mode: "Dark",
    swatches: ["#111214", "#1B1C1F", "#E8A87C"],
  },
] as const;

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number]["value"];
export const DEFAULT_APPEARANCE: AppearanceTheme = "default";

export function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return APPEARANCE_THEMES.some((theme) => theme.value === value);
}

/** Map preferences written by the removed palettes onto the closest remaining theme. */
export function normalizeSavedAppearance(value: unknown): AppearanceTheme {
  if (value == null) return DEFAULT_APPEARANCE;
  if (isAppearanceTheme(value)) return value;
  if (value === "orange-light-grey") return "orange-charcoal";
  if (value === "light-lime-charcoal" || value === "light-lime-grey") return "default";
  throw new Error("workspace.appearance: unsupported theme.");
}
