import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Library, Play, Plus, Search, Users, X, Zap, ChevronDown, History } from "lucide-react";
import { useFloor } from "@/lib/gymmane/store";
import { kExercises, type CatalogExercise } from "@/lib/gymmane/catalog";
import { INDIVIDUAL_PROFILE_ID } from "@/lib/gymmane/models";
import { clientSummary } from "@/lib/gymmane/metrics";
import { formatLoad, isoWeekday, todayIso, WEEKDAYS } from "@/lib/gymmane/engine";
import { weekOverview } from "@/lib/gymmane/dashboard";
import { MUSCLE_LABEL } from "@/lib/gymmane/metrics";
import { registerNativeBackHandler } from "@/lib/native/back-handlers";
import { BackupReminderCard, useBackupReminder } from "@/components/backup-reminder";
import { ExerciseMuscleIllustration } from "@/components/muscle-map";

const field = "min-h-11 min-w-0 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]";
const btn = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-45";
const primary = `${btn} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]`;
const quiet = `${btn} border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:bg-[hsl(var(--muted))]`;
const card = "rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))]";
const kicker = "mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]";
const muted = "text-[hsl(var(--muted-foreground))]";

function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => registerNativeBackHandler(onClose), [onClose]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusable = () => Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? []);
    (panel.current?.querySelector<HTMLElement>("input,select") ?? focusable()[0])?.focus();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const elements = focusable(), first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", keyboard);
    return () => { document.removeEventListener("keydown", keyboard); document.body.style.overflow = overflow; previous?.focus(); };
  }, [onClose]);
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div ref={panel} role="dialog" aria-modal="true" aria-label={title} className="max-h-[92dvh] min-w-0 w-full max-w-lg overflow-y-auto rounded-t-3xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 [overflow-wrap:anywhere] sm:rounded-3xl">
      <div className="mb-4 flex items-center justify-between"><h2 className="display-font text-xl font-semibold">{title}</h2><button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))]" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
      {children}
    </div></div>;
}

const STATUS: Record<string, string> = { "on-floor": "Trained recently", due: "4–7 days since training", overdue: "8+ days since training", new: "No workouts yet" };
const TONE: Record<string, string> = { "on-floor": "text-[var(--status-on-floor-foreground)]", due: "text-[hsl(38_95%_70%)]", overdue: "text-[hsl(0_90%_75%)]", new: muted };

function initials(n: string) { const p = n.trim().split(/\s+/); return (p[0]?.[0] ?? "?") + (p[1]?.[0] ?? ""); }

export function TrainerDashboard({ onAddClient }: { onAddClient: () => void }) {
  const clients = useFloor((s) => s.clients);
  const draft = useFloor((s) => s.draft);
  const individualProfile = useFloor((s) => s.individualProfile);
  const unit = useFloor((s) => s.unit);
  const backupReminder = useBackupReminder();
  const startSession = useFloor((s) => s.startSession);
  const [, go] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dlg, setDlg] = useState<null | "start" | "library">(null);
  const today = todayIso();
  const wd = isoWeekday(today);
  const week = useMemo(() => weekOverview(clients, today), [clients, today]);
  const rows = useMemo(() => clients.map((client) => ({ client, summary: clientSummary(client, today) })), [clients, today]);
  const query = search.trim().toLocaleLowerCase();
  const list = rows.filter(({ client, summary }) => (status === "all" || summary.status === status) && client.name.toLocaleLowerCase().includes(query));
  const hasFilters = query.length > 0 || status !== "all";
  const clearFilters = () => { setSearch(""); setStatus("all"); };
  const personalDraft = draft?.clientId === INDIVIDUAL_PROFILE_ID;
  const draftClient = draft && !personalDraft ? clients.find((c) => c.id === draft.clientId) : undefined;
  const planned = clients.flatMap((client) => {
    const rid = client.weeklyPlan?.[String(wd)];
    const routine = rid ? client.routines.find((r) => r.id === rid) : undefined;
    return routine ? [{ client, routine }] : [];
  });
  const due = planned.filter(({ client, routine }) => !client.sessions.some((s) => s.date === today && s.routineId === routine.id));

  const resume = () => {
    const current = useFloor.getState().draft;
    if (!current) return;
    go(current.clientId === INDIVIDUAL_PROFILE_ID ? "/" : `/clients/${current.clientId}`);
    window.dispatchEvent(new Event("setstack:resume-workout"));
  };
  const start = (clientId: string, routineId: string | null) => {
    if (useFloor.getState().draft) { resume(); return; }
    startSession(clientId, routineId);
    if (useFloor.getState().draft?.clientId === clientId) go(`/clients/${clientId}`);
  };
  const head = due[0];

  return <div className="min-w-0 [overflow-wrap:anywhere]">
    <div className="mb-5 flex items-end justify-between gap-3">
      <div><p className={`${kicker} mb-1`}>{WEEKDAYS[wd - 1]} · {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" })}</p><h1 className="display-font text-3xl font-semibold tracking-tight">Today</h1></div>
      <button className={primary} onClick={onAddClient} data-testid="button-add-client"><Plus size={16} />Add client</button>
    </div>

    {!draft && <BackupReminderCard
      hasLocalData={clients.length > 0 || individualProfile.sessions.length > 0}
      dataLabel={clients.length > 0 ? "client data" : "training data"}
      onConfirmSaved={backupReminder.recordSuccessfulExport}
      onRemindLater={backupReminder.remindLater}
    />}

    {(clients.length > 0 || draft) && <section className={`${card} mb-4 p-4 sm:p-5`} data-testid="card-next-workout">
      {draft ? <>
        <p className={kicker}>{personalDraft ? "Personal workout in progress" : "Workout in progress"}</p>
        <h2 className="display-font mt-2 text-2xl font-semibold">{personalDraft ? `Your training · ${draft.name}` : `${draftClient?.name ?? "Unknown client"} · ${draft.name}`}</h2>
        <p className={`mt-1 text-sm ${muted}`}>{draft.exercises.length} exercises · {draft.exercises.reduce((n, e) => n + e.sets.length, 0)} sets logged (not yet saved)</p>
        <button className={`${primary} mt-4 w-full sm:w-auto`} onClick={resume} data-testid="button-resume-workout"><Play size={16} />Resume workout</button>
      </> : head ? <>
        <p className={kicker}>Next planned today · {due.length} client{due.length === 1 ? "" : "s"}</p>
        <h2 className="display-font mt-2 text-2xl font-semibold">{head.client.name} · {head.routine.name}</h2>
        <p className={`mt-1 text-sm ${muted}`}>{head.routine.exerciseIds.length} exercises</p>
        <div className="mt-4 flex flex-wrap gap-2"><button className={primary} onClick={() => start(head.client.id, head.routine.id)} data-testid="button-start-next"><Play size={16} />Start workout</button><button className={quiet} onClick={() => setDlg("start")} data-testid="button-quick-start">Choose another</button></div>
        {due.length > 1 && <div className="mt-4 divide-y divide-[hsl(var(--border))] border-t border-[hsl(var(--border))]">{due.slice(1, 4).map(({ client, routine }) => <button key={client.id} onClick={() => start(client.id, routine.id)} className="flex min-h-11 w-full items-center justify-between text-left text-sm"><span className="truncate">{client.name} <span className={muted}>· {routine.name}</span></span><Play size={14} className="text-[hsl(var(--primary))]" /></button>)}</div>}
      </> : <>
        <p className={kicker}>Next workout</p>
        <h2 className="display-font mt-2 text-xl font-semibold">{planned.length ? "Today's planned workouts are logged" : "No workouts scheduled"}</h2>
        <p className={`mt-1 text-sm ${muted}`}>{planned.length ? "Start a routine or a blank workout for any client." : "Plan a workout for a client or start one now."}</p>
        {clients.length > 0 && <div className="mt-4 flex flex-wrap gap-2"><button className={primary} onClick={() => setDlg("start")} data-testid="button-quick-start"><Zap size={16} />Start workout</button></div>}
      </>}
    </section>}

    <div className="mb-3 grid grid-cols-2 gap-2" data-testid="overview-stats">
      {[["Clients", String(clients.length)], ["Workouts this week", String(week.workouts)]].map(([l, v]) => <div key={l} className={`${card} p-3`}><p className={kicker}>{l}</p><p className="display-font mt-1 text-xl font-semibold">{v}</p></div>)}
    </div>

    <details className={`group ${card} mb-4 overflow-hidden`} data-testid="weekly-activity-details">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <span className="text-sm font-semibold">Weekly activity</span>
        <span className={`flex items-center gap-2 text-right text-xs ${muted}`}><span>{week.sets} sets · {formatLoad(week.volume, unit)}</span><ChevronDown size={15} className="shrink-0 transition-transform group-open:rotate-180"/></span>
      </summary>
      <div className="border-t border-[hsl(var(--border))] p-3">
        <p className={`mb-3 text-xs ${muted}`}>{clients.length ? `${week.activeClients} of ${clients.length} clients trained this week${week.goal > 0 ? ` · ${week.done}/${week.goal} goal days met` : ""}. Completed workouts only; drafts excluded.` : "Your first completed workout will appear here."}</p>
        <div className="grid grid-cols-7 gap-1.5">{week.days.map((d, i) => <div key={d.date} className={`rounded-xl bg-[hsl(var(--muted))] py-2 text-center ${i + 1 === wd ? "ring-1 ring-[hsl(var(--primary))]" : ""}`}><div className="mono text-[9px] font-semibold">{WEEKDAYS[i]}</div><div className="mono mt-1 text-sm">{d.count}</div><div className={`mono text-[9px] ${muted}`}>{d.planned} plan</div></div>)}</div>
        <p className={`mt-2 text-[10px] ${muted}`}>Completed workouts per day, and clients planned.</p>
      </div>
    </details>

    <div className={`mb-5 grid ${clients.length ? "grid-cols-2" : "grid-cols-1 sm:grid-cols-2"} gap-2`}>
      {clients.length > 0 && <button className={quiet} onClick={() => draft ? resume() : setDlg("start")} data-testid="button-open-quick-start"><Zap size={16} />{draft ? "Resume workout" : "Start workout"}</button>}
      <button className={quiet} onClick={() => setDlg("library")} data-testid="button-open-library"><Library size={16} />Exercises</button>
    </div>

    <div className="grid grid-cols-1 gap-6" data-testid="dashboard-columns">
      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="display-font text-xl font-semibold">Clients</h2>{clients.length > 0 && <div className="flex min-w-0 gap-2"><div className="relative min-w-0 flex-1 sm:flex-none"><Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} size={15}/><input className={`${field} pl-9 pr-10 sm:w-48`} placeholder="Find a client" aria-label="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-athletes"/>{search && <button type="button" className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))]" aria-label="Clear client search" onClick={() => setSearch("")} data-testid="button-clear-client-search"><X size={15}/></button>}</div><select className={`${field} w-auto shrink-0`} aria-label="Filter clients by status" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="select-athlete-status"><option value="all">All</option><option value="on-floor">Recent</option><option value="due">4–7 days</option><option value="overdue">8+ days</option><option value="new">No workouts</option></select></div>}</div>
        <p className="sr-only" role="status" aria-live="polite">{clients.length ? `Showing ${list.length} of ${clients.length} clients` : "Build your client list"}</p>
        <div className="space-y-2">{list.map(({ client, summary }) => <div key={client.id} className={`${card} flex items-center gap-3 p-3`}>
          <Link href={`/clients/${client.id}`} className="flex min-w-0 flex-1 items-center gap-3" data-testid={`link-client-${client.id}`}>
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-sm font-bold text-[hsl(var(--primary))]">{initials(client.name)}</span>
            <span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate font-semibold">{client.name}</span>{client.id.startsWith("seed-") && <span className="rounded-full bg-[hsl(38_90%_55%/.16)] px-2 py-0.5 text-[9px] font-bold uppercase text-[hsl(38_95%_70%)]">Demo</span>}</span><span className={`mono block truncate text-[11px] ${muted}`}><span className={TONE[summary.status]}>{STATUS[summary.status]}</span> · {summary.weekDone}/{client.weeklyGoal} this week</span></span>
          </Link>
          <Link href={`/clients/${client.id}?tab=history`} aria-label={`Workout history for ${client.name}`} title="History" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-[hsl(var(--muted))]" data-testid={`link-history-${client.id}`}><History size={17} /></Link>
          <button onClick={() => start(client.id, client.weeklyPlan?.[String(wd)] ?? client.routines[0]?.id ?? null)} aria-label={draft ? "Resume current workout" : `Start session for ${client.name}`} title={draft ? "Resume current workout" : "Start session"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))]" data-testid={`button-start-session-${client.id}`}><Zap size={17} /></button>
        </div>)}
          {!list.length && <div className={`${card} p-5 text-center sm:p-6`} data-testid={clients.length ? "empty-client-search" : "empty-client-list"}>{clients.length ? <><Users className={`mx-auto ${muted}`} size={20} /><h3 className="mt-2 font-semibold">No clients match.</h3><p className={`mt-1 text-sm ${muted}`}>Adjust the search or status filter.</p>{hasFilters && <button type="button" className={`${quiet} mt-3`} onClick={clearFilters} data-testid="button-clear-client-filters">Clear filters</button>}</> : <><Users className="mx-auto text-[hsl(var(--primary))]" size={20} /><h3 className="mt-2 font-semibold">Build your client list</h3><p className={`mt-1 text-sm ${muted}`}>Add your first client to start tracking workouts and progress.</p></>}</div>}
        </div>
      </div>
    </div>
    {dlg === "start" && <QuickStart onClose={() => setDlg(null)} onStart={(c, r) => { setDlg(null); start(c, r); }} hasDraft={!!draft} />}
    {dlg === "library" && <ExerciseLibrary onClose={() => setDlg(null)} />}
  </div>;
}

function QuickStart({ onClose, onStart, hasDraft }: { onClose: () => void; onStart: (c: string, r: string | null) => void; hasDraft: boolean }) {
  const clients = useFloor((s) => s.clients);
  const [cid, setCid] = useState(clients[0]?.id ?? "");
  const [rid, setRid] = useState("");
  const client = clients.find((c) => c.id === cid);
  return <Dialog title="Start workout" onClose={onClose}>
    {hasDraft && <p className="mb-3 rounded-xl bg-[hsl(38_90%_55%/.16)] p-3 text-sm text-[hsl(38_95%_70%)]">A workout is already in progress. Starting will resume it, not replace it.</p>}
    <label className="mb-1 block text-xs font-semibold text-[hsl(var(--muted-foreground))]" htmlFor="qs-client">Client</label>
    <select id="qs-client" className={field} value={cid} onChange={(e) => { setCid(e.target.value); setRid(""); }} data-testid="select-quick-client">{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    <label className="mb-1 mt-3 block text-xs font-semibold text-[hsl(var(--muted-foreground))]" htmlFor="qs-routine">Routine</label>
    <select id="qs-routine" className={field} value={rid} onChange={(e) => setRid(e.target.value)} data-testid="select-quick-routine"><option value="">Blank workout</option>{client?.routines.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
    <div className="mt-5 flex justify-end gap-2"><button className={quiet} onClick={onClose}>Cancel</button><button className={primary} disabled={!client} onClick={() => onStart(cid, rid || null)} data-testid="button-confirm-quick-start"><Play size={16} />{hasDraft ? "Resume workout" : "Start"}</button></div>
  </Dialog>;
}

export function ExerciseLibrary({
  onClose,
  inline = false,
  onSelect,
}: {
  onClose?: () => void;
  inline?: boolean;
  onSelect?: (exercise: CatalogExercise) => void;
}) {
  const [q, setQ] = useState("");
  const custom = useFloor((state) => state.custom);
  const pool = useMemo(() => [...kExercises, ...custom], [custom]);
  const matches = pool.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  const found = matches.slice(0, 60);
  const list = <>
    <div className="relative mb-3"><Search size={15} className={`absolute left-3 top-3 ${muted}`} /><input autoFocus={inline} className={`${field} pl-9`} placeholder={`Search ${pool.length} exercises`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" data-testid="input-search-library" /></div>
    <p className={`mb-2 text-[11px] ${muted}`}>Bright areas: primary targets. Softer areas: secondary targets. Illustrations, not measured activation.</p>
    <div className="divide-y divide-[hsl(var(--border))]">{found.map((e) => {
      const details = <><ExerciseMuscleIllustration exercise={e} /><span className="min-w-0 flex-1 text-left"><span className="block text-sm font-medium">{e.name}</span><span className={`mono mt-1 block text-[10px] ${muted}`}>{MUSCLE_LABEL[e.primary] ?? e.primary} · {e.equipment}</span></span></>;
      return onSelect
        ? <button key={e.id} type="button" className="flex min-h-14 w-full items-center gap-3 py-2 text-left hover:bg-[hsl(var(--muted))]" aria-label={`Add ${e.name} to personal workout`} onClick={() => onSelect(e)} data-testid={`button-select-library-exercise-${e.id}`}>{details}<span className="rounded-lg bg-[hsl(var(--accent))] px-3 py-2 text-xs font-semibold text-[hsl(var(--primary))]">Add</span></button>
        : <div key={e.id} className="flex items-center gap-3 py-2">{details}</div>;
    })}</div>
    {!found.length && <p className={`py-6 text-center text-sm ${muted}`}>No exercises match.</p>}
    {matches.length > found.length && <p className={`mt-3 text-xs ${muted}`}>Showing {found.length} of {matches.length} matches. Search to narrow the list.</p>}
    {!onSelect && <p className={`mt-3 text-[11px] ${muted}`}>Read-only. Add exercises to a workout while logging.</p>}
  </>;
  if (inline) return <section className="space-y-4" data-testid="individual-exercises-screen">
    <header><p className={kicker}>Your training</p><h1 className="display-font mt-1 text-3xl font-semibold tracking-tight">Exercises</h1><p className={`mt-2 text-sm ${muted}`}>Search the exercise library and add a movement directly to your personal workout.</p></header>
    <div className={`${card} min-w-0 p-4 sm:p-5`}>{list}</div>
  </section>;
  return <Dialog title="Exercise library" onClose={onClose ?? (() => {})}>{list}</Dialog>;
}
