// SPDX-License-Identifier: GPL-3.0-only
// Original GymMane muscle map card (progress_screen.dart _MuscleMapCard) + radar, for CoachAura clients.
// Copyright (C) InlitX and contributors. Source: third_party/gymmane/upstream-analytics.
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { BodyHeatMap, BodyRecoveryMap } from "@/components/gymmane-body-map";
import { MuscleRadarCard } from "@/components/gymmane-muscle-radar";
import { useFloor } from "@/lib/gymmane/store";
import { kExercises } from "@/lib/gymmane/catalog";
import type { Client } from "@/lib/gymmane/models";
import { COACHAURA_INTENSITY_SCALE } from "@/lib/gymmane/muscle-intensity-colors";
import {
  GYM_LABELS, GYM_MUSCLES, HEAT_RAMPS, heatColor, hoursUntilRecovered, originalMuscleAnalytics,
  recoveryColor, type GymMuscle, type HeatTone,
} from "@/lib/gymmane/original-muscle-analytics";

const panel = "rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-4 sm:p-5";
type Mode = 7 | 30 | 0;
const modeLabel = (m: Mode) => m === 0 ? "Recovery" : `${m} days`;
const label = (id: string) => GYM_LABELS[id as GymMuscle] ?? id;

export default function GymManeMuscleAnalytics({ client }: { client: Client }) {
  const clients = useFloor((s) => s.clients);
  const custom = useFloor((s) => s.custom);
  const [, setLocation] = useLocation();
  const [mode, setMode] = useState<Mode>(() => new URLSearchParams(window.location.search).get("period") === "30" ? 30 : 7);
  const [focus, setFocus] = useState<string | null>(null);
  const [tone, setTone] = useState<HeatTone | "coachaura">("coachaura");
  useEffect(() => setFocus(null), [client.id]);
  const days = mode === 30 ? 30 : 7;
  // Like GymMane's build(), recompute against the current time on interaction.
  const data = originalMuscleAnalytics(client, [...kExercises, ...custom], days, new Date());
  const toggle = (id: string) => setFocus((f) => f === id ? null : id);
  const choose = (m: Mode) => { setMode(m); setFocus(null); };
  const hasWork = Object.keys(data.sets).length > 0;
  const noFatigue = Object.keys(data.fatigue).length === 0;
  const pct = (v: number) => Math.round(v * 100);

  let readout: string;
  if (mode === 0) {
    if (!focus) readout = "Tap a muscle to see its estimated recovery.";
    else {
      const v = data.recovery[focus as GymMuscle] ?? 1, h = hoursUntilRecovered(focus, data.fatigue);
      readout = `${label(focus)} · ${pct(v)}% estimated recovery${h == null ? "" : ` · about ${h} h to reach 80% (model estimate)`}`;
    }
  } else if (focus) {
    const sets = data.sets[focus] ?? 0, heat = data.heat[focus] ?? 0;
    readout = `${label(focus)} · ${sets.toFixed(1)} weighted set equivalents (${Math.round(sets)} sets) · ${pct(heat)}% of ${data.target.toFixed(1)}-set target`;
  } else readout = !hasWork ? "No recorded work in this period." : data.behind.length ? `Behind target: ${data.behind.map(label).join(" · ")}` : "Tap a muscle to inspect it.";

  return <section className="space-y-5" data-testid="gymmane-original-analytics">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mono text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Original GymMane analytics</p>
        <h2 className="display-font mt-1 text-2xl font-semibold tracking-tight">Muscle map</h2>
      </div>
      <label className="min-w-0 text-xs font-semibold sm:w-56">Displaying client
        <select value={client.id} onChange={(e) => setLocation(`/clients/${e.target.value}?tab=muscles${mode ? `&period=${mode}` : ""}`)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm" data-testid="select-gymmane-client">
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}{c.id.startsWith("seed-") ? " (Demo)" : ""}</option>)}
        </select>
      </label>
    </div>

    <div className={panel}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label="Map mode" className="inline-flex rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1">
          {([7, 30, 0] as const).map((m) => <button key={m} type="button" aria-pressed={mode === m} onClick={() => choose(m)} data-testid={`button-gymmane-mode-${m}`} className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${mode === m ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : ""}`}>{modeLabel(m)}</button>)}
        </div>
        {mode !== 0 && <label className="text-xs font-semibold">Palette <select value={tone} onChange={(e) => setTone(e.target.value as HeatTone | "coachaura")} className="ml-2 min-h-10 rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-2 text-sm" data-testid="select-gymmane-palette">
          <option value="coachaura">CoachAura lime</option>
          {(Object.keys(HEAT_RAMPS) as HeatTone[]).map((t) => <option key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}{t === "ember" ? " (original)" : ""}</option>)}</select></label>}
      </div>

      {mode === 0 && <div className="mb-4 flex items-center gap-4" data-testid="gymmane-recovery-summary">
        <svg width="56" height="56" viewBox="0 0 56 56" role="img" aria-label={`Overall estimated recovery ${data.overall}%`}>
          <circle cx="28" cy="28" r="23" fill="none" stroke="#222228" strokeWidth="4.5"/>
          <circle cx="28" cy="28" r="23" fill="none" stroke={recoveryColor(data.overall / 100)} strokeWidth="4.5" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 23 * data.overall / 100} 999`} transform="rotate(-90 28 28)"/>
          <text x="28" y="33" textAnchor="middle" fontSize="14" fontWeight="800" fill="#F5F5F7">{data.overall}</text>
        </svg>
        <div><p className="text-sm font-bold">{data.overall}% overall estimated recovery</p>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">{data.tired.length ? `Still recovering (model): ${data.tired.slice(0, 3).map(label).join(" · ")}` : "All muscle groups at or above 80% in the model."}</p></div>
      </div>}

      <div className="mx-auto max-w-[760px]">
        {mode === 0 ? <BodyRecoveryMap recovery={data.recovery} focus={focus} onTap={toggle}/> : <BodyHeatMap intensity={data.heat} tone={tone} focus={focus} onTap={toggle}/>}
      </div>

      {mode !== 0 && tone === "coachaura" ? <div className="mt-4" data-testid="gymmane-legend">
        <ul className="grid grid-cols-3 gap-x-2 gap-y-2" aria-label="Training workload colour scale">
          {COACHAURA_INTENSITY_SCALE.map((entry) => <li key={entry.label} className="flex min-w-0 items-center gap-2">
            <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded border border-white/15" style={{ backgroundColor: entry.color }}/>
            <span className="text-[11px] leading-tight text-[hsl(var(--foreground))]">{entry.label}<span className="mt-0.5 block text-[10px] text-[hsl(var(--muted-foreground))]">{entry.marker}</span></span>
          </li>)}
        </ul>
        <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">Colour brightens between these workload markers (% of target). This is not a recovery scale.</p>
      </div> : <div className="mt-4 flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))]" data-testid="gymmane-legend">
        <span>{mode === 0 ? "Fatigued" : "Low"}</span>
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-[7px] flex-1 rounded-sm" style={{ background: mode === 0 ? recoveryColor(i / 4) : heatColor([0, .1, .3, .6, .9][i]!, tone as HeatTone) }}/>)}
        <span>{mode === 0 ? "Fresh" : "High"}</span>
      </div>}
      <p className="mt-3 min-h-9 text-sm font-medium" aria-live="polite" data-testid="text-gymmane-readout">{readout}</p>

      <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Select muscle group">
        {GYM_MUSCLES.map((id) => <button key={id} type="button" aria-pressed={focus === id} onClick={() => toggle(id)} data-testid={`button-gymmane-muscle-${id}`} className={`min-h-9 rounded-lg border px-2.5 text-xs font-semibold ${focus === id ? "border-[hsl(var(--primary))] text-[hsl(var(--primary))]" : "border-[hsl(var(--border))]"}`}>{label(id)}</button>)}
      </div>

      <div className="mt-4 space-y-1.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
        {mode === 0 && <p>Recovery percentages are model estimates from logged sets, not a physiological measurement or readiness assessment.{noFatigue && " No recorded work in the model window, so every muscle defaults to 100%; that is a default, not a finding."}</p>}
        {mode !== 0 && <p>Heat is weighted set equivalents (secondary muscles count 0.5) against a {data.target.toFixed(1)}-set target for {days} days.</p>}
        {data.dateOnly && <p>Some logs hold a date only; the model assumes they occurred at local midnight, so hour-level recovery estimates are approximate.</p>}
        {data.unmapped.length > 0 && <p>Sets with no map region are not coloured: {data.unmapped.join(", ")}.</p>}
      </div>
    </div>

    <MuscleRadarCard radar={data.radar}/>
  </section>;
}
