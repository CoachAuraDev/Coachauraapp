// SPDX-License-Identifier: GPL-3.0-only
// React SVG port of InlitX/GymMane body_map.dart (BodyHeatMap, BodyRecoveryMap, BodyPainter, muscleAt).
// Copyright (C) InlitX and contributors. Source: third_party/gymmane/upstream-analytics.
import { useRef } from "react";
import body from "@/assets/gymmane-body.json";
import { coachAuraIntensityColor } from "@/lib/gymmane/muscle-intensity-colors";
import { GYM_COLORS, GYM_LABELS, GYM_MUSCLES, heatColor, lerpColor, recoveryColor, type GymMuscle, type HeatTone } from "@/lib/gymmane/original-muscle-analytics";

type BodyData = { width: number; height: number; bodyBaseMain: string[]; bodyBaseLite: string[]; muscleFills: Record<string, string[]>; muscleHits: Record<string, string[]> };
export const BODY = body as unknown as BodyData;
const FILL_IDS = Object.keys(BODY.muscleFills);
const OUTLINE = "#F5F5F7"; // gc.text in the dark theme

/** Probe set per muscle, first-match order, fallback to fills when no hit shapes exist (original muscleAt). */
const probes = (id: string) => { const h = BODY.muscleHits[id]; return h && h.length ? h : BODY.muscleFills[id]!; };

function BodyCanvas({ color, focus, onTap, label }: { color: (id: string) => string; focus: string | null; onTap?: (id: string) => void; label: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const bodyLite = lerpColor(GYM_COLORS.raised, GYM_COLORS.tertiary, .14);
  function tap(e: React.MouseEvent<SVGSVGElement>) {
    const svg = ref.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm || !onTap) return;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    for (const id of FILL_IDS) {
      for (const el of Array.from(svg.querySelectorAll<SVGGeometryElement>(`path[data-probe="${id}"]`)))
        if (el.isPointInFill(p)) { onTap(id); return; }
    }
  }
  return <svg ref={ref} viewBox={`0 0 ${BODY.width} ${BODY.height}`} className="block w-full" role="img" aria-label={label} onClick={tap} style={{ cursor: onTap ? "pointer" : undefined }} data-testid="svg-gymmane-body">
    {BODY.bodyBaseMain.map((d, i) => <path key={`m${i}`} d={d} fill={GYM_COLORS.raised}/>)}
    {BODY.bodyBaseLite.map((d, i) => <path key={`l${i}`} d={d} fill={bodyLite}/>)}
    {FILL_IDS.map((id) => <g key={id} fill={color(id)} data-muscle={id}>{BODY.muscleFills[id]!.map((d, i) => <path key={i} d={d}/>)}</g>)}
    {focus && BODY.muscleFills[focus] && <g fill="none" stroke={OUTLINE} strokeWidth={2.5} pointerEvents="none">{BODY.muscleFills[focus]!.map((d, i) => <path key={i} d={d}/>)}</g>}
    <g opacity={0} pointerEvents="none" aria-hidden="true">{FILL_IDS.flatMap((id) => probes(id).map((d, i) => <path key={`${id}${i}`} d={d} data-probe={id}/>))}</g>
  </svg>;
}

export function BodyHeatMap({ intensity, tone, focus, onTap }: { intensity: Record<string, number>; tone: HeatTone | "coachaura"; focus: string | null; onTap?: (id: string) => void }) {
  return <BodyCanvas focus={focus} onTap={onTap} label="Front and back muscle heat map" color={(id) => tone === "coachaura" ? coachAuraIntensityColor(intensity[id] ?? 0) : heatColor(intensity[id] ?? 0, tone)}/>;
}

export function BodyRecoveryMap({ recovery, focus, onTap }: { recovery: Record<string, number>; focus: string | null; onTap?: (id: string) => void }) {
  return <BodyCanvas focus={focus} onTap={onTap} label="Front and back estimated muscle recovery map" color={(id) => recoveryColor(recovery[id] ?? 1)}/>;
}

export const MUSCLE_BUTTONS: GymMuscle[] = [...GYM_MUSCLES];
export { GYM_LABELS };
