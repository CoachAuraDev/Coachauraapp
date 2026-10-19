import { useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Activity, ArrowUp, CircleHelp, Dumbbell, ShieldCheck, Zap } from "lucide-react";
import { MuscleMap } from "@/components/muscle-map";
import { useFloor } from "@/lib/gymmane/store";
import { kExercises } from "@/lib/gymmane/catalog";
import { todayIso, shortDate } from "@/lib/gymmane/engine";
import {
  analyzeMuscleActivity,
  formatRecoveryStatus,
  type ActivityPeriod,
  type MuscleGroup,
  type RecoveryStatus,
} from "@/lib/gymmane/muscle-activity";
import type { Client } from "@/lib/gymmane/models";

const panel = "rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-4 sm:p-5";
const statusTone: Record<RecoveryStatus, string> = {
  "no-data": "bg-[hsl(240_5%_20%)] text-[hsl(240_5%_72%)]",
  recovered: "bg-[var(--status-recovered-background)] text-[var(--status-recovered-foreground)]",
  recovering: "bg-[hsl(205_90%_60%/.16)] text-[hsl(205_95%_78%)]",
  "recently-trained": "bg-[hsl(38_90%_55%/.16)] text-[hsl(38_95%_72%)]",
  "high-recent-workload": "bg-[hsl(0_80%_60%/.16)] text-[hsl(0_90%_78%)]",
};
const intensityLabel = { none: "No recorded work", low: "Low", moderate: "Moderate", high: "High", "very-high": "Very high" };

export function MuscleActivityDashboard({ client }: { client: Client }) {
  const clients = useFloor((state) => state.clients);
  const custom = useFloor((state) => state.custom);
  const startSession = useFloor((state) => state.startSession);
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState<ActivityPeriod>(() => new URLSearchParams(window.location.search).get("period") === "30" ? 30 : 7);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup>("chest");
  const mapRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const today = todayIso();
  const result = useMemo(
    () => analyzeMuscleActivity(client, [...kExercises, ...custom], period, today),
    [client, custom, period, today],
  );
  const selected = result.muscles.find((muscle) => muscle.id === selectedMuscle)!;
  const recoveryCounts = useMemo(() => {
    const counts = new Map<RecoveryStatus, number>();
    for (const muscle of result.muscles) counts.set(muscle.recoveryStatus, (counts.get(muscle.recoveryStatus) ?? 0) + 1);
    return [...counts.entries()];
  }, [result]);
  function selectMuscle(id: MuscleGroup) {
    setSelectedMuscle(id);
    if (window.matchMedia("(max-width: 1279px)").matches) {
      requestAnimationFrame(() => {
        detailRef.current?.focus({ preventScroll: true });
        detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }
  function choosePeriod(days: ActivityPeriod) {
    setPeriod(days);
    setLocation(`/clients/${client.id}?tab=muscles&period=${days}`);
  }

  return <section className="space-y-5" data-testid="dashboard-muscle-activity">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="mono text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Completed workout analytics</p>
        <h2 className="display-font mt-1 text-2xl font-semibold tracking-tight">Muscle activity & recovery</h2>
        <p className="mt-1 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">A clear view of training exposure—not a measure of biological recovery.</p>
      </div>
      <label className="min-w-0 text-xs font-semibold sm:w-56">Displaying client
        <select value={client.id} onChange={(event) => setLocation(`/clients/${event.target.value}?tab=muscles&period=${period}`)} className="mt-1.5 min-h-11 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm text-[hsl(var(--foreground))]" data-testid="select-muscle-client">
          {clients.map((item) => <option key={item.id} value={item.id}>{item.name}{item.id.startsWith("seed-") ? " (Demo)" : ""}</option>)}
        </select>
      </label>
    </div>

    <div className="flex flex-wrap items-center justify-between gap-3">
      <div role="group" aria-label="Activity period" className="inline-flex rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1">
        {([7, 30] as const).map((days) => <button key={days} type="button" aria-pressed={period === days} onClick={() => choosePeriod(days)} data-testid={`button-muscle-period-${days}`} className={`min-h-11 rounded-lg px-4 text-sm font-semibold ${period === days ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "text-[hsl(var(--foreground))]"}`}>Last {days} days</button>)}
      </div>
      <p className="mono text-xs text-[hsl(var(--muted-foreground))]" data-testid="text-muscle-date-range">{shortDate(result.startDate)} – {shortDate(result.endDate)} · inclusive</p>
    </div>

    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <div className={panel}><Dumbbell size={16} className="text-[hsl(var(--chart-1))]"/><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Working sets logged</p><p className="mono mt-1 text-2xl font-bold" data-testid="text-muscle-working-sets">{result.workingSets}</p></div>
      <div className={panel}><Activity size={16} className="text-[hsl(var(--chart-1))]"/><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Completed sessions with work</p><p className="mono mt-1 text-2xl font-bold" data-testid="text-muscle-session-count">{result.completedSessions}</p></div>
      <div className={`${panel} col-span-2 sm:col-span-1`}><ShieldCheck size={16} className="text-[hsl(var(--chart-1))]"/><p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">Muscles exposed in this period</p><p className="mono mt-1 text-2xl font-bold" data-testid="text-muscle-exposed-count">{result.muscles.filter((muscle) => muscle.directSets + muscle.indirectSets > 0).length}<span className="text-sm font-normal text-[hsl(var(--muted-foreground))]"> / 18</span></p></div>
    </div>

    {result.workingSets === 0 && <div className={`${panel} border-dashed`} data-testid="empty-muscle-history">
      <h3 className="font-semibold">Progress starts here</h3>
      <p className="mt-1 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Complete a workout for {client.name} to build this view. Unfinished and warm-up-only sessions are not included.</p>
      <button type="button" onClick={() => startSession(client.id, client.routines[0]?.id ?? null)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[hsl(var(--primary))] px-4 text-sm font-semibold text-[hsl(var(--primary-foreground))]" data-testid="button-muscle-start-session"><Zap size={16}/>Start workout</button>
    </div>}
    {result.unmappedExercises.length > 0 && <div className="rounded-xl border border-[hsl(38_90%_55%/.35)] bg-[hsl(38_90%_55%/.1)] p-4 text-sm text-[hsl(38_95%_80%)]" data-testid="warning-unmapped-exercises">
      <p className="font-semibold">Some working sets have no muscle mapping</p>
      <p className="mt-1">{result.unmappedExercises.join(", ")}. These sets are included in the logged-set total, but not coloured on the map. Assign their primary and secondary groups in the routine editor’s custom-exercise section.</p>
    </div>}

    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,.85fr)]">
      <div className="scroll-mt-20 space-y-3" ref={mapRef}>
        <MuscleMap muscles={result.muscles} selectedMuscle={selectedMuscle} onSelect={selectMuscle}/>
        <p className="px-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Colours reflect effort-weighted set-equivalents per week across the selected {period}-day period. Low &lt;3 · moderate 3–&lt;6 · high 6–&lt;10 · very high ≥10. Tap a region or a labelled muscle button to inspect it.</p>
      </div>
      <div className="space-y-4">
        <section ref={detailRef} tabIndex={-1} className={`${panel} scroll-mt-20 outline-none`} aria-live="polite" data-testid="panel-muscle-details">
          <button type="button" onClick={() => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })} className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-lg border border-[hsl(var(--border))] px-3 text-xs font-semibold xl:hidden" data-testid="button-return-muscle-map"><ArrowUp size={14}/>Back to muscle map</button>
          <p className="mono text-[10px] uppercase tracking-[.15em] text-[hsl(var(--muted-foreground))]">Selected muscle</p>
          <h3 className="display-font mt-1 text-2xl font-semibold" data-testid="text-selected-muscle">{selected.label}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="rounded-lg bg-[hsl(var(--muted))] px-3 py-1.5 text-xs font-semibold" data-testid="text-selected-intensity">{intensityLabel[selected.intensity]} activity</span>
            <span className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${statusTone[selected.recoveryStatus]}`} data-testid="status-muscle-recovery">{formatRecoveryStatus(selected.recoveryStatus)}</span>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4">
            <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Working sets involving muscle</dt><dd className="mono mt-1 text-xl font-bold" data-testid="text-selected-total-sets">{selected.directSets + selected.indirectSets}</dd></div>
            <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Direct / indirect</dt><dd className="mono mt-1 text-xl font-bold" data-testid="text-selected-direct-indirect">{selected.directSets} / {selected.indirectSets}</dd></div>
            <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Weighted sets · selected period</dt><dd className="mono mt-1 font-semibold" data-testid="text-selected-weighted-sets">{selected.effectiveSetEquivalents.toFixed(2)}</dd></div>
            <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Weekly-equivalent load</dt><dd className="mono mt-1 font-semibold" data-testid="text-selected-weekly-load">{selected.weeklyEquivalent.toFixed(2)}</dd></div>
            <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Most recent working session</dt><dd className="mt-1 text-sm font-semibold" data-testid="text-selected-last-session">{selected.lastWorkoutDate ? `${shortDate(selected.lastWorkoutDate)} · ${selected.daysSinceLastWorkout === 0 ? "today" : `${selected.daysSinceLastWorkout} days ago`}` : "No recorded working sets"}</dd></div>
            <div><dt className="text-xs text-[hsl(var(--muted-foreground))]">Training frequency</dt><dd className="mt-1 text-sm font-semibold" data-testid="text-selected-frequency">{selected.recent7DaySessions} sessions / last 7 days<br/><span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">{selected.selectedPeriodSessions} in selected period</span></dd></div>
          </dl>
          <div className="mt-5 border-t border-[hsl(var(--border))] pt-4">
            <h4 className="text-sm font-semibold">Contributing exercises</h4>
            {selected.contributors.length > 0 ? <ul className="mt-2 divide-y divide-[hsl(var(--border))]">{selected.contributors.map((item) => <li key={item.exerciseId} className="py-3" data-testid={`row-muscle-contributor-${item.exerciseId}`}>
              <p className="text-sm font-semibold">{item.exerciseName}</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{item.directSets} direct · {item.indirectSets} indirect sets · {item.effectiveSetEquivalents.toFixed(2)} weighted</p>
            </li>)}</ul> : <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">No working sets contributed to this muscle in the selected period.</p>}
          </div>
        </section>
        <section className={panel}>
          <h3 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck size={17}/>Current recovery estimates</h3>
          <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Uses the latest exposure and rolling seven-day workload, regardless of the activity period selected above.</p>
          <div className="mt-3 flex flex-wrap gap-2" data-testid="summary-muscle-recovery">{recoveryCounts.map(([status, count]) => <span key={status} className={`rounded-lg px-2.5 py-1.5 text-xs ${statusTone[status]}`}>{formatRecoveryStatus(status)} · {count}</span>)}</div>
          <p className="mt-3 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">These labels are estimates from training logs, not biological measurements. Pain, sleep, illness and individual recovery are not measured. Colour alone never means a muscle is ready to train.</p>
        </section>
      </div>
    </div>

    <details className={panel} data-testid="section-muscle-calculations">
      <summary className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold" data-testid="button-muscle-calculations"><CircleHelp size={17}/>How workload and recovery are estimated</summary>
      <div className="mt-3 space-y-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
        <p>Completed logs only. Sets with zero reps and warm-ups are excluded. Other logged set types count as working sets. Direct involvement = 1.0; secondary involvement = 0.5. The GymMane catalog’s labels are refined into shoulder/back subregions by exercise movement rules; common presses and rows include the supporting muscles listed above. Explicit custom mappings are honoured exactly.</p>
        <p>Effort uses recorded RIR (10 − RPE): RIR 0–1 → ×1.25; RIR 2–3 → ×1.0; RIR 4+ → ×0.75. Missing effort → ×1.0. Weekly-equivalent load = weighted sets × 7 ÷ selected days. Raw direct and indirect set counts are not reduced by these weights.</p>
        <p>Recovery window = 24h + 6h × min(latest-day weighted sets, 8) + 8h × max(last-seven-day sessions − 1, 0), capped at 96h. High recent workload means ≥12 weighted sets or ≥3 exposures in seven days. Otherwise today/yesterday is “Recently trained”, inside the window is “Recovering”, and outside is “Recovered · estimate”. Logged sessions store dates only, so these are broad day-level estimates, not precise timers.</p>
      </div>
    </details>
  </section>;
}
