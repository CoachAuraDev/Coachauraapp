// Presentation only: workload values, original heat thresholds and recovery are unchanged.
import { lerpColor } from "./original-muscle-analytics.ts";

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
