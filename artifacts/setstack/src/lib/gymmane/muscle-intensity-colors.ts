// Presentation only: workload values, original heat thresholds and recovery are unchanged.
import { lerpColor } from "./original-muscle-analytics.ts";
import { intensityForWeeklyEquivalent } from "./muscle-activity.ts";
import type { AppearanceTheme } from "./appearance.ts";

/** CoachAura's existing weekly-equivalent categories; olive→lime is presentation
 * within the low band only, not an additional calculation or recovery category.
 */
export const COACHAURA_WORKLOAD_LEGEND = [
  { label: "Inactive", marker: "0", color: "#35353B" },
  { label: "Very low", marker: "Near 0", color: "#45521F" },
  { label: "Low", marker: "<3", color: "#667F25" },
  { label: "Moderate", marker: "3–<6", color: "#86B832" },
  { label: "High", marker: "6–<10", color: "#A5E635" },
  { label: "Very high", marker: "≥10", color: "#C6FF57" },
] as const;

const ORANGE_WORKLOAD_LEGENDS = {
  "orange-charcoal": [
    { label: "Inactive", marker: "0", color: "#35353B" },
    { label: "Very low", marker: "Near 0", color: "#572B13" },
    { label: "Low", marker: "<3", color: "#874212" },
    { label: "Moderate", marker: "3–<6", color: "#B9540D" },
    { label: "High", marker: "6–<10", color: "#E66F18" },
    { label: "Very high", marker: "≥10", color: "#FF993D" },
  ],
  "orange-light-grey": [
    { label: "Inactive", marker: "0", color: "#D5D5DB" },
    { label: "Very low", marker: "Near 0", color: "#F5D3B8" },
    { label: "Low", marker: "<3", color: "#EEAF79" },
    { label: "Moderate", marker: "3–<6", color: "#D98035" },
    { label: "High", marker: "6–<10", color: "#B95006" },
    { label: "Very high", marker: "≥10", color: "#873700" },
  ],
} as const;

const LIME_LIGHT_WORKLOAD_LEGEND = [
  { label: "Inactive", marker: "0", color: "#D5D9D1" },
  { label: "Very low", marker: "Near 0", color: "#E3EDCA" },
  { label: "Low", marker: "<3", color: "#C9DE91" },
  { label: "Moderate", marker: "3–<6", color: "#A9CF56" },
  { label: "High", marker: "6–<10", color: "#79A91C" },
  { label: "Very high", marker: "≥10", color: "#466B0C" },
] as const;

export function workloadLegendForAppearance(appearance: AppearanceTheme) {
  if (appearance === "default" || appearance === "light-lime-charcoal") return COACHAURA_WORKLOAD_LEGEND;
  if (appearance === "light-lime-grey") return LIME_LIGHT_WORKLOAD_LEGEND;
  return ORANGE_WORKLOAD_LEGENDS[appearance];
}

export function coachAuraWorkloadColor(weeklyEquivalent: number, appearance: AppearanceTheme = "default"): string {
  const palette = workloadLegendForAppearance(appearance);
  if (!Number.isFinite(weeklyEquivalent) || weeklyEquivalent <= 0) return palette[0].color;
  const intensity = intensityForWeeklyEquivalent(weeklyEquivalent);
  if (intensity === "low") return lerpColor(palette[1].color, palette[2].color, weeklyEquivalent / 3).toUpperCase();
  if (intensity === "moderate") return palette[3].color;
  if (intensity === "high") return palette[4].color;
  return palette[5].color;
}

export const COACHAURA_INTENSITY_SCALE = [
  { label: "Inactive", value: 0, marker: "0%", color: "#35353B" },
  { label: "Very low", value: 0, marker: ">0%", color: "#45521F" },
  { label: "Low", value: .25, marker: "25%", color: "#667F25" },
  { label: "Moderate", value: .5, marker: "50%", color: "#86B832" },
  { label: "High", value: .75, marker: "75%", color: "#A5E635" },
  { label: "Very high", value: 1, marker: "100%", color: "#C6FF57" },
] as const;

/** Interpolate presentation colour at original 0/.25/.5/.75/1 boundaries.
 * Zero stays charcoal; any positive recorded workload starts at deep olive.
 * This does not add an intensity band or alter the source heatLevel function.
 */
export function coachAuraIntensityColor(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return COACHAURA_INTENSITY_SCALE[0].color;
  const v = Math.min(1, value);
  const anchors = COACHAURA_INTENSITY_SCALE.slice(1);
  for (let i = 1; i < anchors.length; i++) {
    const a = anchors[i - 1]!, b = anchors[i]!;
    if (v <= b.value) return lerpColor(a.color, b.color, (v - a.value) / (b.value - a.value)).toUpperCase();
  }
  return anchors[anchors.length - 1]!.color;
}
