// SPDX-License-Identifier: GPL-3.0-only
// React SVG port of InlitX/GymMane muscle_radar.dart (MuscleRadarCard, _RadarPainter, MuscleFigurePainter).
// Copyright (C) InlitX and contributors. Source: third_party/gymmane/upstream-analytics.
import { useMemo, useState } from "react";
import { BODY } from "@/components/gymmane-body-map";
import { GYM_COLORS, GYM_LABELS, RADAR_AXES, lerpColor, type GymMuscle } from "@/lib/gymmane/original-muscle-analytics";

type Radar = { sets: Record<typeof RADAR_AXES[number], number>; top: number; values: number[]; behind: string[] };
type Axis = typeof RADAR_AXES[number];
type Rect = { l: number; t: number; r: number; b: number };
const MERGED: Partial<Record<string, string>> = { abdomen: "obliques", back: "lowerback" };
const BACK_VIEW = new Set(["trapezius", "back", "triceps", "glutes", "hamstrings", "calves"]);
const half = (id: string): Rect => BACK_VIEW.has(id) ? { l: 270, t: 0, r: 540, b: 462 } : { l: 0, t: 0, r: 262, b: 462 };
export function cropRect(id: string): Rect {
  const cx = BACK_VIEW.has(id) ? 411 : 115;
  if (id === "calves") return { l: cx - 100, t: 262, r: cx + 100, b: 462 };
  const top = id === "quads" || id === "hamstrings" || id === "glutes" ? 160 : -4;
  return { l: cx - 135, t: top, r: cx + 135, b: top + 270 };
}
const cache = new Map<string, Rect>();
/** MuscleFigurePainter.content: bounds of sampled base-body outline points (step 2) inside crop ∩ half. */
function contentRect(id: string): Rect {
  const hit = cache.get(id); if (hit) return hit;
  const c = cropRect(id), h = half(id);
  const box = { l: Math.max(c.l, h.l), t: Math.max(c.t, h.t), r: Math.min(c.r, h.r), b: Math.min(c.b, h.b) };
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("style", "position:absolute;width:0;height:0;visibility:hidden");
  document.body.appendChild(svg);
  for (const d of [...BODY.bodyBaseMain, ...BODY.bodyBaseLite]) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d); svg.appendChild(p);
    const len = p.getTotalLength();
    for (let at = 0; at < len; at += 2) {
      const q = p.getPointAtLength(at);
      if (q.x < box.l || q.x >= box.r || q.y < box.t || q.y >= box.b) continue;
      l = Math.min(l, q.x); t = Math.min(t, q.y); r = Math.max(r, q.x); b = Math.max(b, q.y);
    }
  }
  svg.remove();
  const out = Number.isFinite(l) ? { l, t, r, b } : box;
  cache.set(id, out);
  return out;
}

const SKIN = "#E4E1DC"; // dark-theme skin of MuscleFigurePainter
const REST = lerpColor(SKIN, GYM_COLORS.raised, .22);
const ACCENT = "hsl(81 88% 62%)"; // CoachAura lime in place of gc.accent
const GRID = "#3A3A44"; // gc.border

const S = 1000, C = S / 2, SCALE = 2.5, GAP = 6 * SCALE; // source px at ~400px card width

export function MuscleRadarCard({ radar }: { radar: Radar }) {
  const [picked, setPicked] = useState<Axis | null>(null);
  const n = RADAR_AXES.length, icon = S * .165, radius = S / 2 - GAP - icon;
  const at = (i: number, r: number) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [C + Math.cos(a) * r, C + Math.sin(a) * r] as const; };
  const poly = (r: (i: number) => number) => RADAR_AXES.map((_, i) => at(i, r(i)).join(",")).join(" ");
  const pickedIdx = picked ? RADAR_AXES.indexOf(picked) : -1;
  const place = useMemo(() => RADAR_AXES.map((id, i) => {
    const a = -Math.PI / 2 + i * 2 * Math.PI / n, cr = cropRect(id), b = contentRect(id);
    const k = icon / (cr.r - cr.l), bw = b.r - b.l, bh = b.b - b.t;
    const reach = radius + GAP + (Math.abs(Math.cos(a)) * bw + Math.abs(Math.sin(a)) * bh) * k / 2;
    return [C + Math.cos(a) * reach - ((b.l + b.r) / 2 - cr.l) * k, C + Math.sin(a) * reach - ((b.t + b.b) / 2 - cr.t) * k] as const;
  }), [n, icon, radius]);
  const label = (id: Axis) => `${GYM_LABELS[id as GymMuscle]} · ${Math.round(radar.sets[id])} sets`;
  const readout = picked ? label(picked) : radar.top <= 0 ? "No recorded work in the last 30 days." : radar.behind.length === 0 ? "Well balanced across muscle groups." : `Focus next: ${radar.behind.map((id) => GYM_LABELS[id as GymMuscle]).join(", ")}`;
  return <section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-4 sm:p-5" data-testid="card-gymmane-radar">
    <h3 className="display-font text-xl font-semibold">Muscle balance</h3>
    <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Last 30 days, always — independent of the map's period. Normalised to the most-trained axis; abs includes obliques, back includes lower back.</p>
    <svg viewBox={`0 0 ${S} ${S}`} className="mx-auto mt-3 block w-full max-w-[520px]" role="group" aria-label="Muscle balance radar, last 30 days">
      {[1, 2, 3, 4].map((ring) => <polygon key={ring} points={poly(() => radius * ring / 4)} fill="none" stroke={GRID} strokeWidth={SCALE}/>)}
      {RADAR_AXES.map((_, i) => { const [x, y] = at(i, radius); return <line key={i} x1={C} y1={C} x2={x} y2={y} stroke={GRID} strokeWidth={SCALE}/>; })}
      <polygon points={poly((i) => radius * Math.min(1, Math.max(0, radar.values[i]!)))} fill={ACCENT} fillOpacity={.22} stroke={ACCENT} strokeWidth={2 * SCALE} strokeLinejoin="round" data-testid="polygon-gymmane-radar"/>
      {RADAR_AXES.map((_, i) => { const [x, y] = at(i, radius * Math.min(1, Math.max(0, radar.values[i]!))); return <circle key={i} cx={x} cy={y} r={(i === pickedIdx ? 5 : 3) * SCALE} fill={i === pickedIdx ? "#F5F5F7" : ACCENT}/>; })}
      {RADAR_AXES.map((id, i) => {
        const on = picked === id, [x, y] = place[i]!;
        return <g key={id} transform={on ? `translate(${x + icon / 2} ${y + icon / 2}) scale(1.14) translate(${-icon / 2} ${-icon / 2})` : `translate(${x} ${y})`} role="button" tabIndex={0} aria-pressed={on} aria-label={label(id)} style={{ cursor: "pointer" }} data-testid={`radar-axis-${id}`}
          onClick={() => setPicked(on ? null : id)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setPicked(on ? null : id); } }}>
          <rect width={icon} height={icon} fill="transparent"/>
          <svg width={icon} height={icon} viewBox={`${cropRect(id).l} ${cropRect(id).t} ${cropRect(id).r - cropRect(id).l} ${cropRect(id).b - cropRect(id).t}`} overflow="hidden"><FigureInner id={id}/></svg>
        </g>;
      })}
    </svg>
    <p className="mt-1 text-center text-sm font-semibold" aria-live="polite" data-testid="text-gymmane-radar-readout">{readout}</p>
  </section>;
}
function FigureInner({ id }: { id: Axis }) {
  const h = half(id), lit = new Set<string>([id, ...(MERGED[id] ? [MERGED[id]!] : [])]);
  return <g clipPath={`url(#gm-half-${id})`}>
    <defs><clipPath id={`gm-half-${id}`}><rect x={h.l} y={h.t} width={h.r - h.l} height={h.b - h.t}/></clipPath></defs>
    {[...BODY.bodyBaseMain, ...BODY.bodyBaseLite].map((d, i) => <path key={i} d={d} fill={SKIN}/>)}
    {Object.entries(BODY.muscleFills).map(([m, ds]) => <g key={m} fill={lit.has(m) ? ACCENT : REST}>{ds.map((d, i) => <path key={i} d={d}/>)}</g>)}
  </g>;
}
