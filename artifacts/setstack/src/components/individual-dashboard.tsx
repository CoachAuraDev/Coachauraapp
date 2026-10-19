import { Suspense, lazy, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  Dumbbell,
  Library,
  Play,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useFloor } from "@/lib/gymmane/store";
import { BackupReminderCard, useBackupReminder } from "@/components/backup-reminder";
import { kExercises } from "@/lib/gymmane/catalog";
import {
  formatLoad,
  todayIso,
  toDisplay,
  type Unit,
} from "@/lib/gymmane/engine";
import {
  getIndividualOverview,
  getPersonalRecordEvents,
  getStrengthOptions,
  getStrengthSeries,
  getTrainingTrend,
  INDIVIDUAL_RANGES,
  trendMetricLabel,
  trendValue,
  type IndividualRange,
  type TrendFilter,
  type TrendMetric,
} from "@/lib/gymmane/individual-analytics";
import { MUSCLE_GROUPS, type MuscleGroup } from "@/lib/gymmane/muscle-activity";
import { INDIVIDUAL_PROFILE_ID, individualWorkoutOwner, type Draft, type IndividualProfile, type SessionLog } from "@/lib/gymmane/models";

const MuscleActivityDashboard = lazy(() => import("@/components/muscle-activity-dashboard").then((module) => ({ default: module.MuscleActivityDashboard })));

type IndividualDashboardProps = {
  profile: IndividualProfile;
  unit: Unit;
  draft: Draft | null;
  onStartWorkout: () => void;
  onOpenExerciseLibrary: () => void;
  onEditSession: (session: SessionLog) => void;
  onDeleteSession: (session: SessionLog) => void;
};

const panel = "rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-4 sm:p-5";
const kicker = "mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]";
const muted = "text-[hsl(var(--muted-foreground))]";
const field = "min-h-11 w-full min-w-0 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm text-[hsl(var(--foreground))]";
const buttonBase = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-45";
const primaryButton = `${buttonBase} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]`;
const quietButton = `${buttonBase} border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]`;
const axisTick = { fill: "hsl(var(--muted-foreground))", fontSize: 10 };
const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
};

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function volumeLabel(volumeKg: number, unit: Unit) {
  const value = toDisplay(volumeKg, unit);
  return `${Math.round(value).toLocaleString()} ${unit}·reps`;
}

export function IndividualDashboard({
  profile,
  unit,
  draft,
  onStartWorkout,
  onOpenExerciseLibrary,
  onEditSession,
  onDeleteSession,
}: IndividualDashboardProps) {
  const today = todayIso();
  const [range, setRange] = useState<IndividualRange>(30);
  const [strengthExerciseId, setStrengthExerciseId] = useState("");
  const [trendExerciseId, setTrendExerciseId] = useState("");
  const [muscleId, setMuscleId] = useState<MuscleGroup>("chest");
  const [trendMetric, setTrendMetric] = useState<TrendMetric>("sets");
  const custom = useFloor((state) => state.custom);
  const clients = useFloor((state) => state.clients);
  const backupReminder = useBackupReminder();
  const owner = useMemo(() => individualWorkoutOwner(profile), [profile]);
  const library = useMemo(() => [...kExercises, ...custom], [custom]);
  const overview = useMemo(() => getIndividualOverview(owner, range, today), [owner, range, today]);
  const rangeLabel = range === 365 ? "1 year" : `${range} days`;
  const strengthOptions = useMemo(() => getStrengthOptions(owner, today), [owner, today]);
  const trendExerciseOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const session of profile.sessions) {
      if (session.date > today) continue;
      for (const exercise of session.exercises) options.set(exercise.id, exercise.name);
    }
    return [...options].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [profile.sessions, today]);
  const activeStrengthId = strengthOptions.some((option) => option.id === strengthExerciseId)
    ? strengthExerciseId
    : strengthOptions[0]?.id ?? "";
  const activeTrendExerciseId = trendExerciseOptions.some((option) => option.id === trendExerciseId)
    ? trendExerciseId
    : "";
  const strengthSeries = useMemo(
    () => activeStrengthId ? getStrengthSeries(owner, activeStrengthId, range, today) : [],
    [owner, activeStrengthId, range, today],
  );
  const currentStrength = strengthSeries.at(-1);
  const previousStrength = strengthSeries.length > 1 ? strengthSeries.at(-2) : undefined;
  const strengthChange = currentStrength && previousStrength
    && currentStrength.e1rm > 0 && previousStrength.e1rm > 0
    ? currentStrength.e1rm - previousStrength.e1rm
    : null;
  const strengthChangePercent = strengthChange !== null && previousStrength && previousStrength.e1rm > 0
    ? (strengthChange / previousStrength.e1rm) * 100
    : null;
  const trendFilter: TrendFilter = activeTrendExerciseId
    ? { kind: "exercise", exerciseId: activeTrendExerciseId }
    : { kind: "muscle", muscleId };
  const trainingTrend = useMemo(
    () => getTrainingTrend(owner, range, today, trendFilter, library),
    [owner, range, today, trendFilter.kind, activeTrendExerciseId, muscleId, library],
  );
  const frequencyTrend = useMemo(
    () => getTrainingTrend(owner, range, today, { kind: "all" }, library),
    [owner, range, today, library],
  );
  const records = useMemo(() => getPersonalRecordEvents(owner, today).slice(-8).reverse(), [owner, today]);
  const recentSessions = useMemo(
    () => [...profile.sessions].filter((session) => session.date <= today)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, 6),
    [profile.sessions, today],
  );
  const activeExerciseName = strengthOptions.find((option) => option.id === activeStrengthId)?.name ?? "";
  const totalTrendValue = trainingTrend.reduce((sum, point) => sum + trendValue(point, trendMetric, trendFilter), 0);
  return (
    <div className="min-w-0 space-y-5 [overflow-wrap:anywhere]" data-testid="individual-dashboard">
      <header className="relative overflow-hidden rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-7">
        <div aria-hidden="true" className="pointer-events-none absolute -right-14 -top-20 h-56 w-56 rounded-full bg-[hsl(var(--primary))]/10 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className={kicker}>Individual mode · {new Date(`${today}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
            <h1 className="display-font mt-2 text-[clamp(2rem,7vw,3.4rem)] font-semibold leading-[.98] tracking-[-.055em]">Your training,<br className="hidden sm:block" /> in focus.</h1>
            <p className={`mt-3 max-w-xl text-sm leading-relaxed ${muted}`}>A personal view of completed work, strength markers and the rhythm you are building.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={quietButton} onClick={onOpenExerciseLibrary} data-testid="button-individual-open-library"><Library size={16} />Exercise library</button>
             <button type="button" className={primaryButton} onClick={onStartWorkout} data-testid="button-individual-start-workout"><Play size={16} />{draft ? draft.clientId === INDIVIDUAL_PROFILE_ID ? "Continue session" : "Resume active session" : "Start session"}</button>
          </div>
        </div>
      </header>

      {!draft && <BackupReminderCard
        hasLocalData={clients.length > 0 || profile.sessions.length > 0}
        dataLabel="training data"
        onConfirmSaved={backupReminder.recordSuccessfulExport}
        onRemindLater={backupReminder.remindLater}
      />}

      {draft?.clientId === INDIVIDUAL_PROFILE_ID && (
        <section className={`${panel} flex flex-col justify-between gap-3 border-[hsl(var(--primary))]/45 bg-[hsl(var(--accent))] sm:flex-row sm:items-center`} data-testid="card-individual-draft">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"><Dumbbell size={17} /></span>
            <div><p className={kicker}>Session in progress</p><h2 className="display-font mt-1 text-lg font-semibold">{draft.name || "Personal workout"}</h2><p className={`mt-1 text-xs ${muted}`}>{draft.exercises.length} exercises · unsaved session</p></div>
          </div>
          <button type="button" className={primaryButton} onClick={onStartWorkout} data-testid="button-individual-resume-workout"><Play size={15} />Continue</button>
        </section>
      )}
      {draft && draft.clientId !== INDIVIDUAL_PROFILE_ID && <section className={`${panel} flex flex-col justify-between gap-3 border-[hsl(var(--border))] sm:flex-row sm:items-center`} data-testid="card-trainer-draft-in-individual-mode">
        <div><p className={kicker}>Trainer workout in progress</p><p className={`mt-1 text-xs leading-relaxed ${muted}`}>It remains attached to its assigned client. Resuming will not create or move a personal workout.</p></div>
        <button type="button" className={quietButton} onClick={onStartWorkout} data-testid="button-resume-trainer-draft"><Play size={15}/>Resume active workout</button>
      </section>}

      <section aria-label="Training period" className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center" data-testid="individual-date-range">
        <div><p className={kicker}>Training snapshot · {rangeLabel}</p><p className={`mt-1 text-xs ${muted}`}>{dateLabel(overview.from)} – {dateLabel(overview.to)} · inclusive</p></div>
        <div role="group" aria-label="Date range" className="grid grid-cols-4 gap-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-1">
          {INDIVIDUAL_RANGES.map((days) => <button key={days} type="button" aria-label={days === 365 ? "Last year (365 days)" : `Last ${days} days`} aria-pressed={range === days} onClick={() => setRange(days)} className={`min-h-10 rounded-lg px-2 text-xs font-semibold sm:px-4 ${range === days ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]" : "text-[hsl(var(--foreground))]"}`} data-testid={`button-individual-range-${days}`}>{days === 365 ? "1 year" : `${days} days`}</button>)}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label={`${range}-day training summary`} data-testid="individual-overview-stats">
        <div className={`${panel} p-3 sm:p-4`}><p className={kicker}>Workouts</p><p className="display-font mt-2 text-2xl font-semibold tabular-nums" data-testid="text-individual-workouts">{overview.workouts}</p><p className={`mt-1 text-[11px] ${muted}`}>{overview.workoutsThisWeek} this week</p></div>
        <div className={`${panel} p-3 sm:p-4`}><p className={kicker}>Working sets</p><p className="display-font mt-2 text-2xl font-semibold tabular-nums" data-testid="text-individual-working-sets">{overview.workingSets.toLocaleString()}</p><p className={`mt-1 text-[11px] ${muted}`}>Warm-ups excluded</p></div>
        <div className={`${panel} p-3 sm:p-4`}><p className={kicker}>Load volume</p><p className="display-font mt-2 text-xl font-semibold tabular-nums" data-testid="text-individual-volume">{volumeLabel(overview.volumeKg, unit)}</p><p className={`mt-1 text-[11px] ${muted}`}>Σ reps × stored load</p></div>
        <div className={`${panel} p-3 sm:p-4`}><p className={kicker}>Personal records</p><p className="display-font mt-2 text-2xl font-semibold tabular-nums" data-testid="text-individual-records">{overview.recordsAchieved}</p><p className={`mt-1 text-[11px] ${muted}`}>{overview.activeWeeksLastFour} active weeks · last 4</p></div>
      </section>

      <div className="min-w-0" data-testid="region-individual-muscle-analytics">
        <Suspense fallback={<div className={panel} role="status">Loading muscle analytics…</div>}>
          <MuscleActivityDashboard client={owner} individual onStartWorkout={onStartWorkout}/>
        </Suspense>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,.9fr)]">
        <section className={panel} data-testid="region-individual-strength-trend">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div><p className={kicker}>Strength marker</p><h2 className="display-font mt-1 text-xl font-semibold">Estimated 1RM</h2><p className={`mt-1 text-xs ${muted}`}>One best working-set estimate per logged session. No interpolation.</p></div>
            {strengthOptions.length > 0 && <label className="min-w-0 sm:w-[48%]"><span className="sr-only">Exercise for estimated 1RM trend</span><select className={field} value={activeStrengthId} onChange={(event) => setStrengthExerciseId(event.target.value)} aria-label="Exercise for estimated 1RM trend" data-testid="select-individual-strength-exercise">{strengthOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>}
          </div>
          {!strengthOptions.length ? (
            <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-7 text-center" data-testid="empty-individual-strength">
              <Sparkles className="mx-auto text-[hsl(var(--primary))]" size={19}/><h3 className="mt-2 text-sm font-semibold">Your first strength marker is waiting</h3><p className={`mx-auto mt-1 max-w-sm text-xs leading-relaxed ${muted}`}>Log a working set for an exercise to see its estimated 1RM trend here.</p>
              <button type="button" className={`${quietButton} mt-3`} onClick={onStartWorkout} data-testid="button-strength-empty-start"><Play size={15}/>Start a session</button>
            </div>
          ) : strengthSeries.length === 0 ? (
            <p className={`mt-5 rounded-xl bg-[hsl(var(--background))] p-4 text-sm ${muted}`} data-testid="empty-individual-strength-range">No estimates for this exercise in the selected date range.</p>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
                <div><p className={kicker}>Latest estimate</p><p className="display-font mt-1 text-2xl font-semibold tabular-nums" data-testid="text-individual-current-e1rm">{formatLoad(currentStrength!.e1rm, unit)}</p></div>
                {strengthChange !== null && strengthChangePercent !== null && <div><p className={kicker}>Vs previous session</p><p className={`mt-1 flex items-center gap-1 text-sm font-semibold tabular-nums ${strengthChange > 0 ? "text-[hsl(var(--chart-2))]" : muted}`} data-testid="text-individual-e1rm-comparison">{strengthChange > 0 ? <ArrowUpRight size={15}/> : strengthChange < 0 ? <ArrowDownRight size={15}/> : null}{strengthChange > 0 ? "+" : ""}{formatLoad(strengthChange, unit)} <span className="font-normal">({strengthChangePercent > 0 ? "+" : ""}{strengthChangePercent.toFixed(1)}%)</span></p></div>}
                <span className={`ml-auto text-[10px] ${muted}`}>{activeExerciseName} · {dateLabel(currentStrength!.date)}</span>
              </div>
              <div className="mt-3 h-[210px] min-w-0" role="img" aria-label={`Estimated 1RM trend for ${activeExerciseName}`} data-testid="chart-individual-strength">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={strengthSeries} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                    <defs><linearGradient id="individual-strength-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.25}/><stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.015}/></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4"/>
                    <XAxis dataKey="date" tickFormatter={dateLabel} tick={axisTick} tickLine={false} axisLine={false} minTickGap={25}/>
                    <YAxis domain={["auto", "auto"]} tickFormatter={(value: number) => formatLoad(value, unit)} tick={axisTick} tickLine={false} axisLine={false} width={58}/>
                    <Tooltip contentStyle={tooltipStyle} labelFormatter={(label) => dateLabel(String(label))} formatter={(value: number) => [formatLoad(value, unit), "Estimated 1RM"]}/>
                    <Area type="linear" dataKey="e1rm" stroke="hsl(var(--chart-1))" fill="url(#individual-strength-fill)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(var(--chart-1))" }} activeDot={{ r: 5 }} isAnimationActive={false}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className={`mt-2 text-[10px] leading-relaxed ${muted}`}>An estimate from your best logged working set; it is not a tested maximum.</p>
            </>
          )}
        </section>

        <section className={panel} data-testid="region-individual-training-trend">
          <div className="flex flex-col gap-3">
            <div><p className={kicker}>Logged workload</p><h2 className="display-font mt-1 text-xl font-semibold">Training trend</h2><p className={`mt-1 text-xs ${muted}`}>Completed work only; warm-ups excluded.</p></div>
            <div className="grid grid-cols-2 gap-2">
              <label className="min-w-0"><span className="mb-1 block text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">Filter by exercise</span><select className={field} value={activeTrendExerciseId} onChange={(event) => setTrendExerciseId(event.target.value)} aria-label="Filter training trend by exercise" data-testid="select-individual-trend-exercise"><option value="">All exercises</option>{trendExerciseOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
              <label className="min-w-0"><span className="mb-1 block text-[10px] font-semibold text-[hsl(var(--muted-foreground))]">Filter by muscle</span><select className={field} value={muscleId} onChange={(event) => { setMuscleId(event.target.value as MuscleGroup); setTrendExerciseId(""); }} aria-label="Filter training trend by muscle group" data-testid="select-individual-trend-muscle">{MUSCLE_GROUPS.map((muscle) => <option key={muscle.id} value={muscle.id}>{muscle.label}</option>)}</select></label>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div role="group" aria-label="Training trend metric" className="inline-flex rounded-lg bg-[hsl(var(--muted))] p-1">
              {(["sets", "volume"] as const).map((metric) => <button key={metric} type="button" aria-pressed={trendMetric === metric} onClick={() => setTrendMetric(metric)} className={`min-h-9 rounded-md px-3 text-xs font-semibold ${trendMetric === metric ? "bg-[hsl(var(--card))] text-[hsl(var(--foreground))]" : muted}`} data-testid={`button-individual-trend-${metric}`}>{metric === "sets" ? "Working sets" : "Load volume"}</button>)}
            </div>
            <span className={`text-[10px] ${muted}`} data-testid="text-individual-trend-total">{trendMetricLabel(trendMetric, trendFilter, unit)} · {trendMetric === "volume" ? volumeLabel(totalTrendValue, unit) : `${totalTrendValue.toFixed(trendFilter.kind === "muscle" ? 1 : 0)} ${trendFilter.kind === "muscle" ? "weighted sets" : "sets"}`}</span>
          </div>
          {trainingTrend.some((point) => trendValue(point, trendMetric, trendFilter) > 0) ? (
            <div className="mt-2 h-[220px] min-w-0" role="img" aria-label={`${trendMetricLabel(trendMetric, trendFilter, unit)} by time bucket`} data-testid="chart-individual-training-trend">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trainingTrend} margin={{ top: 10, right: 6, left: -20, bottom: 0 }} barCategoryGap="28%">
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4"/>
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={18}/>
                  <YAxis allowDecimals={trendMetric === "volume" || trendFilter.kind === "muscle"} tick={axisTick} tickLine={false} axisLine={false} width={45}/>
                  <Tooltip contentStyle={tooltipStyle} labelFormatter={(_, payload) => payload?.[0]?.payload?.label ?? ""} formatter={(value: number) => [trendMetric === "volume" ? volumeLabel(value, unit) : `${value.toFixed(trendFilter.kind === "muscle" ? 1 : 0)} ${trendFilter.kind === "muscle" ? "weighted sets" : "working sets"}`, trendMetric === "volume" ? "Load volume" : trendFilter.kind === "muscle" ? "Weighted sets" : "Working sets"]}/>
                  <Bar dataKey={(point) => trendValue(point, trendMetric, trendFilter)} name={trendMetric === "volume" ? "Load volume" : "Working sets"} fill="hsl(var(--chart-1))" fillOpacity={0.78} radius={[5, 5, 0, 0]} maxBarSize={36} isAnimationActive={false}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-3 flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-center" data-testid="empty-individual-training-trend"><div><p className="text-sm font-semibold">No logged work in this period</p><p className={`mt-1 text-xs leading-relaxed ${muted}`}>Complete a session and this trend will follow your actual training.</p></div></div>
          )}
          <p className={`mt-2 text-[10px] leading-relaxed ${muted}`}>Load volume = Σ working-set reps × stored load. Warm-ups are excluded.</p>
        </section>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,.85fr)]">
        <section className={panel} data-testid="region-individual-workout-frequency">
          <div className="flex items-end justify-between gap-3"><div><p className={kicker}>Consistency</p><h2 className="display-font mt-1 text-xl font-semibold">Workout frequency</h2><p className={`mt-1 text-xs ${muted}`}>Sessions with working sets · {range} days</p></div><span className="mono text-xs text-[hsl(var(--primary))]">{overview.workouts} total</span></div>
          {frequencyTrend.some((point) => point.workouts > 0) ? <div className="mt-3 h-[180px] min-w-0" role="img" aria-label={`Workout frequency over the last ${range} days`} data-testid="chart-individual-workout-frequency">
            <ResponsiveContainer width="100%" height="100%"><BarChart data={frequencyTrend} margin={{ top: 8, right: 6, left: -20, bottom: 0 }} barCategoryGap="30%"><CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4"/><XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={20}/><YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} width={38}/><Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} ${value === 1 ? "workout" : "workouts"}`, "Frequency"]}/><Bar dataKey="workouts" fill="hsl(var(--chart-2))" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={false}/></BarChart></ResponsiveContainer>
          </div> : <div className="mt-3 flex min-h-[150px] items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-center" data-testid="empty-individual-frequency"><p className={`text-sm ${muted}`}>Your completed sessions will appear here.</p></div>}
          <p className={`mt-2 text-[10px] ${muted}`}>Each bucket counts completed sessions containing at least one working set.</p>
        </section>

        <section className={panel} data-testid="region-individual-records">
          <div className="flex items-start justify-between gap-3"><div><p className={kicker}>Milestones</p><h2 className="display-font mt-1 text-xl font-semibold">Personal records</h2><p className={`mt-1 text-xs ${muted}`}>Recent best estimated 1RM events</p></div><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"><Sparkles size={17}/></span></div>
          {records.length ? <ul className="mt-3 divide-y divide-[hsl(var(--border))]">{records.map((event, index) => <li key={`${event.exerciseId}-${event.date}-${index}`} className="flex min-w-0 items-center gap-3 py-3" data-testid={`row-individual-record-${event.exerciseId}-${index}`}>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted))]"><Dumbbell size={16} className="text-[hsl(var(--primary))]"/></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{event.exerciseName}</p><p className={`mt-1 text-[10px] ${muted}`}>{dateLabel(event.date)} · {event.reps} reps at {formatLoad(event.weightKg, unit)}</p></div>
            <button type="button" className="shrink-0 rounded-lg px-2 py-2 text-right text-xs font-semibold text-[hsl(var(--primary))] hover:bg-[hsl(var(--accent))]" onClick={() => { setStrengthExerciseId(event.exerciseId); document.querySelector('[data-testid="region-individual-strength-trend"]')?.scrollIntoView({ behavior: "smooth", block: "start" }); }} aria-label={`View ${event.exerciseName} estimated 1RM trend`} data-testid={`button-record-trend-${event.exerciseId}-${index}`}>{formatLoad(event.e1rmKg, unit)}<span className="block text-[9px] font-normal">View trend</span></button>
          </li>)}</ul> : <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-center" data-testid="empty-individual-records"><p className="text-sm font-semibold">Records start with your logs</p><p className={`mt-1 text-xs ${muted}`}>A new best working-set estimate will be recorded here.</p></div>}
          <p className={`mt-2 text-[10px] leading-relaxed ${muted}`}>Events are estimates from logged working sets, not tested maximums.</p>
        </section>
      </div>

      <section className={panel} data-testid="region-individual-sessions">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className={kicker}>Your log</p><h2 className="display-font mt-1 text-xl font-semibold">Recent sessions</h2><p className={`mt-1 text-xs ${muted}`}>Saved personal workouts on this device.</p></div>{!recentSessions.length && <button type="button" className={primaryButton} onClick={onStartWorkout} data-testid="button-empty-sessions-start"><Plus size={16}/>Start your first session</button>}</div>
        {recentSessions.length ? <ul className="mt-4 divide-y divide-[hsl(var(--border))]">{recentSessions.map((session) => {
          const setCount = session.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.kind !== "warmup" && set.reps > 0).length, 0);
          return <li key={session.id} className="flex min-w-0 items-center gap-3 py-3" data-testid={`row-individual-session-${session.id}`}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--muted))]"><CalendarDays size={17} className="text-[hsl(var(--primary))]"/></span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{session.name || "Personal workout"}</p><p className={`mt-1 text-[10px] ${muted}`}>{dateLabel(session.date)} · {session.exercises.length} exercises · {setCount} working sets</p></div>
            <button type="button" className="min-h-10 rounded-lg px-3 text-xs font-semibold hover:bg-[hsl(var(--muted))]" onClick={() => onEditSession(session)} aria-label={`Edit ${session.name || "personal workout"} from ${dateLabel(session.date)}`} data-testid={`button-edit-individual-session-${session.id}`}>Edit</button>
            <button type="button" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--destructive))]" onClick={() => onDeleteSession(session)} aria-label={`Delete ${session.name || "personal workout"} from ${dateLabel(session.date)}`} data-testid={`button-delete-individual-session-${session.id}`}><Trash2 size={16}/></button>
          </li>;
        })}</ul> : <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-5 py-8 text-center" data-testid="empty-individual-sessions"><CalendarDays className="mx-auto text-[hsl(var(--primary))]" size={20}/><h3 className="mt-2 font-semibold">Your training log is ready</h3><p className={`mx-auto mt-1 max-w-md text-sm leading-relaxed ${muted}`}>Completed personal sessions will collect here. Start a workout or open the exercise library to plan what you want to train.</p><button type="button" className={`${quietButton} mt-3`} onClick={onOpenExerciseLibrary} data-testid="button-empty-sessions-library"><Library size={15}/>Browse exercises</button></div>}
      </section>

      <p className={`px-1 text-[10px] leading-relaxed ${muted}`} data-testid="text-individual-analytics-method">Completed sessions only. Working-set load volume is Σ reps × stored load; warm-ups are excluded. Strength values are estimates from the logged set data. No dates or values are interpolated.</p>
    </div>
  );
}
