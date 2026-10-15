export const APPEARANCE_THEMES = [
  {
    value: "default",
    label: "Original",
    mode: "Dark",
    swatches: ["#0B0B0D", "#17171B", "#B7F34A"],
  },
  {
    value: "orange-charcoal",
    label: "Orange & Charcoal",
    mode: "Dark",
    swatches: ["#111214", "#1B1C1F", "#F58C2D"],
  },
  {
    value: "orange-light-grey",
    label: "Orange & Light Grey",
    mode: "Light",
    swatches: ["#F2F3F5", "#FFFFFF", "#C65208"],
  },
  {
    value: "light-lime-charcoal",
    label: "Light Lime & Charcoal",
    mode: "Dark",
    swatches: ["#151619", "#202124", "#C6FF57"],
  },
  {
    value: "light-lime-grey",
    label: "Light Lime & Grey",
    mode: "Light",
    swatches: ["#F2F4EF", "#FFFFFF", "#92D831"],
  },
] as const;

export type AppearanceTheme = (typeof APPEARANCE_THEMES)[number]["value"];
export const DEFAULT_APPEARANCE: AppearanceTheme = "orange-charcoal";

export function isAppearanceTheme(value: unknown): value is AppearanceTheme {
  return APPEARANCE_THEMES.some((theme) => theme.value === value);
}
