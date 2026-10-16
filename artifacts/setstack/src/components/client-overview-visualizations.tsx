import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { analyzeMuscleActivity, MUSCLE_GROUPS } from "@/lib/gymmane/muscle-activity";
import {
  muscleBalanceRadar,
  muscleTargetGuidance,
  MUSCLE_TARGET_GROUPS,
  estimatedStrengthHistory,
  strengthExerciseOptions,
  weeklySetPoints,
} from "@/lib/gymmane/client-overview";
import { formatLoad, todayIso, type Unit } from "@/lib/gymmane/engine";
import type { CatalogExercise } from "@/lib/gymmane/catalog";
import type { Client, MuscleTargetGroup } from "@/lib/gymmane/models";
import { useFloor } from "@/lib/gymmane/store";

type ClientOverviewVisualizationsProps = {
  client: Client;
  exerciseLibrary: readonly CatalogExercise[];
  unit: Unit;
};

const cardClass = "rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-4 text-[hsl(var(--card-foreground))] sm:p-5";
const axisTick = { fill: "hsl(var(--muted-foreground))", fontSize: 10 };
const tooltipStyle = {
  backgroundColor: "hsl(var(--popover))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 12,
  color: "hsl(var(--popover-foreground))",
  fontSize: 12,
};

function shortDate(date: string): string {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function targetInputValues(targets: Client["muscleTargets"] = {}): Record<MuscleTargetGroup, string> {
  return Object.fromEntries(
    MUSCLE_TARGET_GROUPS.map(({ id }) => [id, targets?.[id] === undefined ? "" : String(targets[id])]),
  ) as Record<MuscleTargetGroup, string>;
}

export function ClientOverviewVisualizations({ client, exerciseLibrary, unit }: ClientOverviewVisualizationsProps) {
  const updateClient = useFloor((state) => state.updateClient);
  const today = todayIso();
  const muscleActivity = useMemo(
    () => analyzeMuscleActivity(client, exerciseLibrary, 30, today),
    [client, exerciseLibrary, today],
  );
  const radarData = useMemo(() => muscleBalanceRadar(muscleActivity.muscles), [muscleActivity]);
  const targetGuidance = useMemo(
    () => muscleTargetGuidance(radarData, client.muscleTargets),
    [radarData, client.muscleTargets],
  );
  const weeklyData = useMemo(() => weeklySetPoints(client, today), [client, today]);
  const exerciseOptions = useMemo(() => strengthExerciseOptions(client, today), [client, today]);
  const [exerciseId, setExerciseId] = useState("");
  const [targetInputs, setTargetInputs] = useState(() => targetInputValues(client.muscleTargets));
  const [targetError, setTargetError] = useState("");
  const [targetSaved, setTargetSaved] = useState(false);
  useEffect(() => {
    setTargetInputs(targetInputValues(client.muscleTargets));
    setTargetError("");
  }, [client.id, client.muscleTargets]);
  useEffect(() => {
    setTargetSaved(false);
  }, [client.id]);
  const activeExerciseId = exerciseOptions.some((exercise) => exercise.id === exerciseId)
    ? exerciseId
    : exerciseOptions[0]?.id ?? "";
  const strengthHistory = useMemo(
    () => activeExerciseId ? estimatedStrengthHistory(client, activeExerciseId, today).slice(-12) : [],
    [client, activeExerciseId, today],
  );
  const currentEstimate = strengthHistory.at(-1);
  const previousEstimate = strengthHistory.at(-2);
  const estimateChange = currentEstimate && previousEstimate
    ? currentEstimate.e1rm - previousEstimate.e1rm
    : null;
  const missingGroups = radarData.filter((group) => group.weeklyEquivalent <= 0).map((group) => group.label);
  const activeExercise = exerciseOptions.find((exercise) => exercise.id === activeExerciseId);
  const weeklyTotal = weeklyData.reduce((total, point) => total + point.sets, 0);

  function saveMuscleTargets(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targets: Partial<Record<MuscleTargetGroup, number>> = {};
    for (const { id, label } of MUSCLE_TARGET_GROUPS) {
      const value = targetInputs[id].trim();
      if (!value) continue;
      const parsed = Number(value);
      if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(value) || !Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        setTargetError(`${label}: enter a weekly target from 0 to 100, or leave it blank.`);
        setTargetSaved(false);
        return;
      }
      targets[id] = parsed;
    }
    updateClient(client.id, { muscleTargets: Object.keys(targets).length ? targets : undefined });
    setTargetError("");
    setTargetSaved(true);
  }

  return (
    <section aria-label="Client training analytics" className="space-y-5" data-testid="client-training-analytics">
      <div className="grid min-w-0 gap-5 xl:grid-cols-2">
        <Card className={cardClass} data-testid="card-client-muscle-balance">
          <div className="mb-3">
            <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Training coverage · 30 days</p>
            <h2 className="display-font mt-1 text-xl font-semibold tracking-tight">Muscle balance</h2>
            <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
              Weighted working-set equivalents, averaged per week from the last 30 days.
            </p>
          </div>
          {muscleActivity.workingSets > 0 ? (
            <div className="h-[300px] min-w-0 sm:h-[340px]" role="img" aria-label="Radar chart of weekly-equivalent activity by muscle group over the last 30 days">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="66%">
                  <PolarGrid stroke="hsl(var(--border))" />
                  <PolarAngleAxis dataKey="label" tick={{ ...axisTick, fontSize: 9 }} />
                  <PolarRadiusAxis angle={90} tick={false} axisLine={false} />
                  <Radar
                    name="Weekly-equivalent sets"
                    dataKey="weeklyEquivalent"
                    stroke="hsl(var(--chart-1))"
                    fill="hsl(var(--chart-1))"
                    fillOpacity={0.22}
                    strokeWidth={2}
                    dot={{ r: 2, fill: "hsl(var(--chart-1))" }}
                    isAnimationActive={false}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => [`${value.toFixed(1)} sets / week`, "Activity"]}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 text-center">
              <div>
                <p className="text-sm font-semibold">No mapped workout activity yet</p>
                <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Complete a workout with mapped exercises to build this 30-day view.</p>
              </div>
            </div>
          )}
          <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]" aria-live="polite" data-testid="text-client-unmapped-muscles">
            {missingGroups.length
              ? `No mapped activity recorded: ${missingGroups.join(", ")}. This reflects logged exercise mappings, not a training recommendation.`
              : muscleActivity.workingSets > 0
                ? "Every mapped muscle group has some recorded activity in this period."
                : "Muscle activity is calculated from this client's completed workout logs."}
          </p>
          {muscleActivity.unmappedExercises.length > 0 && (
            <p className="mt-2 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
              {muscleActivity.unmappedExercises.length} exercise{muscleActivity.unmappedExercises.length === 1 ? "" : "s"} could not be mapped to a muscle group.
            </p>
          )}
          <div className="mt-4 border-t border-[hsl(var(--border))] pt-4">
            <div className="mb-3">
              <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Trainer-defined guidance</p>
              <h3 className="mt-1 text-sm font-semibold">Weekly muscle targets</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-[hsl(var(--muted-foreground))]">
                Compare each target with the 30-day average. This is coaching guidance from logged workload, not a recovery or readiness measure.
              </p>
            </div>
            <form className="space-y-2" onSubmit={saveMuscleTargets} noValidate>
              <div className="grid gap-2 sm:grid-cols-2">
                {targetGuidance.map((group) => (
                  <div
                    key={group.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_5.5rem] items-center gap-x-2 rounded-lg bg-[hsl(var(--background))] px-3 py-2"
                    data-testid={`client-muscle-target-group-${group.id}`}
                  >
                    <label htmlFor={`muscle-target-${client.id}-${group.id}`} className="min-w-0 truncate text-xs font-medium">
                      {group.label}
                    </label>
                    <span className="text-right text-[10px] tabular-nums text-[hsl(var(--muted-foreground))]" aria-label={`${group.weeklyEquivalent.toFixed(1)} weekly-equivalent sets recorded`}>
                      {group.weeklyEquivalent.toFixed(1)} / wk
                    </span>
                    <input
                      id={`muscle-target-${client.id}-${group.id}`}
                      type="text"
                      inputMode="decimal"
                      value={targetInputs[group.id]}
                      onChange={(event) => {
                        setTargetInputs((current) => ({ ...current, [group.id]: event.target.value }));
                        setTargetError("");
                        setTargetSaved(false);
                      }}
                      placeholder="No target"
                      aria-label={`${group.label} weekly target in weighted set equivalents`}
                      className="h-9 min-w-0 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-2 text-xs tabular-nums text-[hsl(var(--foreground))] outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                      data-testid={`input-muscle-target-${group.id}`}
                    />
                    <p
                      className={`col-span-3 mt-0.5 text-[10px] ${group.target === undefined ? "text-[hsl(var(--muted-foreground))]" : group.belowTarget ? "font-semibold text-[hsl(var(--chart-3))]" : "text-[hsl(var(--muted-foreground))]"}`}
                      data-testid={`text-muscle-guidance-${group.id}`}
                    >
                      {group.target === undefined
                        ? "No target set"
                        : group.belowTarget
                          ? `Below coaching target · ${group.target} / wk`
                          : `At or above coaching target · ${group.target} / wk`}
                    </p>
                  </div>
                ))}
              </div>
              {targetError && <p role="alert" className="text-xs text-[hsl(var(--destructive))]">{targetError}</p>}
              {targetSaved && <p role="status" className="text-xs text-[hsl(var(--muted-foreground))]">Weekly muscle targets saved for this client.</p>}
              <button
                type="submit"
                className="min-h-10 rounded-lg bg-[hsl(var(--primary))] px-4 text-xs font-semibold text-[hsl(var(--primary-foreground))] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                data-testid="button-save-muscle-targets"
              >
                Save targets
              </button>
              <p className="text-[10px] text-[hsl(var(--muted-foreground))]">Targets are optional. Leave a field blank to remove that target.</p>
            </form>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className={cardClass} data-testid="card-client-weekly-sets">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Completed work</p>
                <h2 className="display-font mt-1 text-xl font-semibold tracking-tight">Sets this week</h2>
              </div>
              <span className="shrink-0 rounded-full bg-[hsl(var(--accent))] px-2.5 py-1 text-[10px] font-semibold text-[hsl(var(--accent-foreground))]" aria-label={`${weeklyTotal} working sets this week`}>{weeklyTotal} sets</span>
            </div>
            <div className="h-[225px] min-w-0" role="img" aria-label="Completed working sets by weekday, Monday through Sunday">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyData} margin={{ top: 8, right: 4, left: -22, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4" />
                  <XAxis dataKey="day" tick={false} tickLine={false} axisLine={false} height={8} />
                  <YAxis allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.date ? shortDate(payload[0].payload.date) : ""}
                    formatter={(value: number) => [`${value} working sets`, "Completed"]}
                  />
                  <Bar dataKey="sets" radius={[5, 5, 0, 0]} maxBarSize={34} isAnimationActive={false}>
                    {weeklyData.map((point) => (
                      <Cell
                        key={point.date}
                        fill={point.isToday ? "hsl(var(--primary))" : "hsl(var(--chart-1))"}
                        fillOpacity={point.isToday ? 1 : point.isFuture ? 0.28 : 0.68}
                        stroke={point.isToday ? "hsl(var(--primary))" : "transparent"}
                        strokeWidth={point.isToday ? 2 : 0}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
              <div className="grid grid-cols-7 gap-1" aria-hidden="true">
                {weeklyData.map((point) => (
                  <span
                    key={point.date}
                    className={`rounded-md py-1 text-center text-[10px] ${point.isToday ? "bg-[hsl(var(--primary))] font-bold text-[hsl(var(--primary-foreground))]" : "text-[hsl(var(--muted-foreground))]"}`}
                  >
                    {point.day}
                  </span>
                ))}
              </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[hsl(var(--muted-foreground))]">
              <span><span aria-hidden="true" className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm bg-[hsl(var(--primary))]" />Today</span>
              <span>Warm-ups and planned sets are excluded.</span>
            </div>
            <ul className="sr-only" aria-label="Working sets by day">
              {weeklyData.map((point) => <li key={point.date}>{point.day}{point.isToday ? ", today" : ""}: {point.sets} working sets</li>)}
            </ul>
          </Card>

          <Card className={cardClass} data-testid="card-client-strength-trend">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Strength markers</p>
                <h2 className="display-font mt-1 text-xl font-semibold tracking-tight">Estimated 1RM</h2>
                <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">One best working-set estimate per completed session.</p>
              </div>
              {exerciseOptions.length > 0 && (
                <label className="block min-w-0 sm:w-[48%]">
                  <span className="sr-only">Choose exercise for estimated one-rep max trend</span>
                  <select
                    value={activeExerciseId}
                    onChange={(event) => setExerciseId(event.target.value)}
                    className="min-h-11 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-xs font-medium text-[hsl(var(--foreground))] outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))]"
                    aria-label="Exercise for estimated 1RM trend"
                    data-testid="select-client-strength-exercise"
                  >
                    {exerciseOptions.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select>
                </label>
              )}
            </div>
            {exerciseOptions.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] px-4 py-6 text-center">
                <p className="text-sm font-semibold">No strength history yet</p>
                <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Log a completed session with at least one weighted working set to see an estimate here.</p>
              </div>
            ) : strengthHistory.length === 0 ? (
              <p className="mt-5 rounded-xl bg-[hsl(var(--background))] p-4 text-sm text-[hsl(var(--muted-foreground))]">No valid completed-session estimates for this exercise.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-end gap-x-6 gap-y-2">
                  <div>
                    <p className="mono text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Current estimate</p>
                    <p className="display-font mt-1 text-2xl font-semibold tabular-nums" data-testid="text-client-current-estimate">
                      {formatLoad(currentEstimate!.e1rm, unit)}
                    </p>
                  </div>
                  {estimateChange !== null && (
                    <div>
                      <p className="mono text-[9px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Change · vs previous session</p>
                      <p className={`mt-1 text-sm font-semibold tabular-nums ${estimateChange > 0 ? "text-[hsl(var(--chart-2))]" : estimateChange < 0 ? "text-[hsl(var(--muted-foreground))]" : "text-[hsl(var(--foreground))]"}`} data-testid="text-client-estimate-change">
                        {estimateChange > 0 ? "+" : ""}{formatLoad(estimateChange, unit)}
                      </p>
                    </div>
                  )}
                  {activeExercise && <p className="ml-auto max-w-full truncate text-[10px] text-[hsl(var(--muted-foreground))]">Latest · {shortDate(currentEstimate!.date)}</p>}
                </div>
                <div className="mt-2 h-[190px] min-w-0" role="img" aria-label={`Estimated one-rep max trend for ${activeExercise?.name ?? "selected exercise"}, based on the latest ${strengthHistory.length} logged sessions`}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={strengthHistory} margin={{ top: 12, right: 8, left: -17, bottom: 0 }}>
                      <defs>
                        <linearGradient id="client-e1rm-area" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                        </linearGradient>
                        <filter id="client-e1rm-glow" x="-100%" y="-100%" width="300%" height="300%">
                          <feGaussianBlur stdDeviation="3" result="blur" />
                          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                        </filter>
                      </defs>
                      <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 4" />
                      <XAxis dataKey="date" tickFormatter={shortDate} tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis
                        domain={["auto", "auto"]}
                        tickFormatter={(value: number) => formatLoad(value, unit)}
                        tick={axisTick}
                        tickLine={false}
                        axisLine={false}
                        width={58}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => shortDate(String(label))}
                        formatter={(value: number) => [formatLoad(value, unit), "Estimated 1RM"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="e1rm"
                        stroke="hsl(var(--chart-1))"
                        fill="url(#client-e1rm-area)"
                        strokeWidth={2.5}
                        dot={false}
                        isAnimationActive={false}
                      />
                      {currentEstimate && (
                        <ReferenceDot
                          x={currentEstimate.date}
                          y={currentEstimate.e1rm}
                          r={5}
                          fill="hsl(var(--chart-1))"
                          stroke="hsl(var(--card))"
                          strokeWidth={2}
                          filter="url(#client-e1rm-glow)"
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <ul className="sr-only" aria-label="Estimated one-rep max history">
                  {strengthHistory.map((point, index) => <li key={`${point.date}-${index}`}>{shortDate(point.date)}: {formatLoad(point.e1rm, unit)}</li>)}
                </ul>
              </>
            )}
          </Card>
        </div>
      </div>
      <p className="sr-only" aria-label="Muscle groups shown in the activity map">{MUSCLE_GROUPS.map((group) => group.label).join(", ")}</p>
    </section>
  );
}

export default ClientOverviewVisualizations;
