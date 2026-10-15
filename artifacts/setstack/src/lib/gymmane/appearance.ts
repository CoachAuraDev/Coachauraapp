export const APPEARANCE_THEMES = [
  { value: "default", label: "CoachAura (current)", mode: "Dark" },
  { value: "orange-charcoal", label: "Orange & Charcoal", mode: "Dark" },
  { value: "orange-light-grey", label: "Orange & Light Grey", mode: "Light" },
] as const;

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number]["value"];
export const DEFAULT_APPEARANCE: AppearanceTheme = "default";

export function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return APPEARANCE_THEMES.some((theme) => theme.value === value);
}
