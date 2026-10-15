import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Dumbbell, Library, Play, Plus, Scale, Search, Users, X, Zap, ChevronDown, ChevronRight, History } from "lucide-react";
import { useFloor, exercisePool } from "@/lib/gymmane/store";
import { clientSummary } from "@/lib/gymmane/metrics";
import { formatLoad, isoWeekday, shortDate, todayIso, WEEKDAYS } from "@/lib/gymmane/engine";
import { recentActivity, weekOverview } from "@/lib/gymmane/dashboard";
import { MUSCLE_LABEL } from "@/lib/gymmane/metrics";
import { registerNativeBackHandler } from "@/lib/native/back-handlers";

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
const TONE: Record<string, string> = { "on-floor": "text-[hsl(84_80%_70%)]", due: "text-[hsl(38_95%_70%)]", overdue: "text-[hsl(0_90%_75%)]", new: muted };

function initials(n: string) { const p = n.trim().split(/\s+/); return (p[0]?.[0] ?? "?") + (p[1]?.[0] ?? ""); }

export function TrainerDashboard({ onAddClient }: { onAddClient: () => void }) {
  const clients = useFloor((s) => s.clients);
  const draft = useFloor((s) => s.draft);
  const unit = useFloor((s) => s.unit);
  const startSession = useFloor((s) => s.startSession);
  const [, go] = useLocation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [dlg, setDlg] = useState<null | "start" | "library">(null);
  const today = todayIso();
  const wd = isoWeekday(today);
  const week = useMemo(() => weekOverview(clients, today), [clients, today]);
  const activity = useMemo(() => recentActivity(clients, 5, today), [clients, today]);
  const rows = useMemo(() => clients.map((client) => ({ client, summary: clientSummary(client, today) })), [clients, today]);
  const query = search.trim().toLocaleLowerCase();
  const list = rows.filter(({ client, summary }) => (status === "all" || summary.status === status) && client.name.toLocaleLowerCase().includes(query));
  const hasFilters = query.length > 0 || status !== "all";
  const clearFilters = () => { setSearch(""); setStatus("all"); };
  const draftClient = draft ? clients.find((c) => c.id === draft.clientId) : undefined;
  const planned = clients.flatMap((client) => {
    const rid = client.weeklyPlan?.[String(wd)];
    const routine = rid ? client.routines.find((r) => r.id === rid) : undefined;
    return routine ? [{ client, routine }] : [];
  });
  const due = planned.filter(({ client, routine }) => !client.sessions.some((s) => s.date === today && s.routineId === routine.id));

  const resume = () => {
    const current = useFloor.getState().draft;
    if (!current) return;
    go(`/clients/${current.clientId}`);
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

    <section className={`${card} mb-4 p-4 sm:p-5`} data-testid="card-next-workout">
      {draft ? <>
        <p className={kicker}>Workout in progress</p>
        <h2 className="display-font mt-2 text-2xl font-semibold">{draftClient?.name ?? "Unknown client"} · {draft.name}</h2>
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
        <h2 className="display-font mt-2 text-xl font-semibold">{!clients.length ? "No clients yet" : planned.length ? "Today's planned workouts are logged" : "Nothing planned for today"}</h2>
        <p className={`mt-1 text-sm ${muted}`}>{clients.length ? "Start a routine or a blank workout for any client." : "Add a client to start logging workouts."}</p>
        {clients.length > 0 && <div className="mt-4 flex flex-wrap gap-2"><button className={primary} onClick={() => setDlg("start")} data-testid="button-quick-start"><Zap size={16} />Start workout</button></div>}
      </>}
    </section>

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

    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(310px,.8fr)]" data-testid="dashboard-columns">
      <div>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><h2 className="display-font text-xl font-semibold">Clients</h2>{clients.length > 0 && <div className="flex min-w-0 gap-2"><div className="relative min-w-0 flex-1 sm:flex-none"><Search className={`pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 ${muted}`} size={15}/><input className={`${field} pl-9 pr-10 sm:w-48`} placeholder="Find a client" aria-label="Search clients" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search-athletes"/>{search && <button type="button" className="absolute right-1 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))]" aria-label="Clear client search" onClick={() => setSearch("")} data-testid="button-clear-client-search"><X size={15}/></button>}</div><select className={`${field} w-auto shrink-0`} aria-label="Filter clients by status" value={status} onChange={(e) => setStatus(e.target.value)} data-testid="select-athlete-status"><option value="all">All</option><option value="on-floor">Recent</option><option value="due">4–7 days</option><option value="overdue">8+ days</option><option value="new">No workouts</option></select></div>}</div>
        <p className="sr-only" role="status" aria-live="polite">{clients.length ? `Showing ${list.length} of ${clients.length} clients` : "No clients yet"}</p>
        <div className="space-y-2">{list.map(({ client, summary }) => <div key={client.id} className={`${card} flex items-center gap-3 p-3`}>
          <Link href={`/clients/${client.id}`} className="flex min-w-0 flex-1 items-center gap-3" data-testid={`link-client-${client.id}`}>
            <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-sm font-bold text-[hsl(var(--primary))]">{initials(client.name)}</span>
            <span className="min-w-0"><span className="flex items-center gap-2"><span className="truncate font-semibold">{client.name}</span>{client.id.startsWith("seed-") && <span className="rounded-full bg-[hsl(38_90%_55%/.16)] px-2 py-0.5 text-[9px] font-bold uppercase text-[hsl(38_95%_70%)]">Demo</span>}</span><span className={`mono block truncate text-[11px] ${muted}`}><span className={TONE[summary.status]}>{STATUS[summary.status]}</span> · {summary.weekDone}/{client.weeklyGoal} this week</span></span>
          </Link>
          <Link href={`/clients/${client.id}?tab=history`} aria-label={`Workout history for ${client.name}`} title="History" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl hover:bg-[hsl(var(--muted))]" data-testid={`link-history-${client.id}`}><History size={17} /></Link>
          <button onClick={() => start(client.id, client.weeklyPlan?.[String(wd)] ?? client.routines[0]?.id ?? null)} aria-label={draft ? "Resume current workout" : `Start session for ${client.name}`} title={draft ? "Resume current workout" : "Start session"} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--secondary))]" data-testid={`button-start-session-${client.id}`}><Zap size={17} /></button>
        </div>)}
          {!list.length && <div className={`${card} p-6 text-center`}><Users className={`mx-auto ${muted}`} size={24} /><h3 className="mt-3 font-semibold">{clients.length ? "No clients match." : "No clients yet."}</h3><p className={`mt-1 text-sm ${muted}`}>{clients.length ? "Adjust the search or status filter." : "Use Add client above to create the first profile."}</p>{clients.length > 0 && hasFilters && <button type="button" className={`${quiet} mt-3`} onClick={clearFilters} data-testid="button-clear-client-filters">Clear filters</button>}</div>}
        </div>
      </div>
      <section className={`${card} h-fit p-4`}><h2 className="display-font mb-3 text-xl font-semibold">Recent activity</h2>
        {activity.length ? <div className="space-y-1">{activity.map((a, i) => <Link key={`${a.kind}-${i}-${a.date}`} href={a.kind === "workout" ? `/clients/${a.client.id}?tab=history` : `/clients/${a.client.id}`} className="flex min-h-11 items-center gap-3" data-testid={`link-activity-${i}`}>
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]">{a.kind === "workout" ? <Dumbbell size={15} /> : <Scale size={15} />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{a.client.name} <span className={`font-normal ${muted}`}>· {a.kind === "workout" ? a.session.name : `Bodyweight ${formatLoad(a.kg, unit)}`}</span></span><span className={`mono text-[10px] ${muted}`}>{shortDate(a.date)}{a.kind === "workout" ? ` · ${a.session.exercises?.length ?? 0} exercises` : ""}</span></span><ChevronRight size={15} className={muted} /></Link>)}</div>
          : <p className={`text-sm ${muted}`}>Completed workouts and bodyweight entries will appear here.</p>}
      </section>
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

function ExerciseLibrary({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const pool = useMemo(() => exercisePool(), []);
  const matches = pool.filter((e) => e.name.toLowerCase().includes(q.toLowerCase()));
  const found = matches.slice(0, 60);
  return <Dialog title="Exercise library" onClose={onClose}>
    <div className="relative mb-3"><Search size={15} className={`absolute left-3 top-3 ${muted}`} /><input autoFocus className={`${field} pl-9`} placeholder={`Search ${pool.length} exercises`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search exercises" data-testid="input-search-library" /></div>
    <div className="divide-y divide-[hsl(var(--border))]">{found.map((e) => <div key={e.id} className="flex min-h-11 items-center justify-between gap-3 py-2"><span className="truncate text-sm font-medium">{e.name}</span><span className={`mono shrink-0 text-[10px] ${muted}`}>{MUSCLE_LABEL[e.primary] ?? e.primary} · {e.equipment}</span></div>)}</div>
    {!found.length && <p className={`py-6 text-center text-sm ${muted}`}>No exercises match.</p>}
    {matches.length > found.length && <p className={`mt-3 text-xs ${muted}`}>Showing {found.length} of {matches.length} matches. Search to narrow the list.</p>}
    <p className={`mt-3 text-[11px] ${muted}`}>Read-only. Add exercises to a workout while logging.</p>
  </Dialog>;
}
