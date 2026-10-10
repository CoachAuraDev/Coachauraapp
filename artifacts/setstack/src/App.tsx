import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Route, Switch, useLocation, useParams } from "wouter";
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleHelp, ClipboardList, Dumbbell, FileUp,
  HeartPulse, Menu, MoreHorizontal, Plus, Settings, ShieldCheck, Sparkles, Trash2,
  UserRound, Users, Weight, X, Zap,
} from "lucide-react";
import { useFloor, exercisePool } from "@/lib/gymmane/store";
import { kProgramTemplates } from "@/lib/gymmane/programs";
import type { Client, Routine } from "@/lib/gymmane/models";
import type { CatalogExercise } from "@/lib/gymmane/catalog";
import { fromDisplay, formatLoad, isoWeekday, shortDate, shiftIso, todayIso, toDisplay, uid, weekStart, WEEKDAYS } from "@/lib/gymmane/engine";
import { clientSummary, lastPerformance, personalRecords, bestSetOneRm, suggestSet } from "@/lib/gymmane/metrics";
import { MuscleActivityDashboard } from "@/components/muscle-activity-dashboard";
import { CustomExerciseMuscles } from "@/components/custom-exercise-muscles";
import { registerNativeBackHandler } from "@/lib/native/back-handlers";
import { isAndroidApp } from "@/lib/native/android";
import { exportBackupFile } from "@/lib/native/backup";

const fieldClass = "w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 py-2.5 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))]";
const btn = "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-px disabled:pointer-events-none disabled:opacity-45";
const primaryBtn = `${btn} bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]`;
const quietBtn = `${btn} border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]`;
const labelClass = "mb-1.5 block text-xs font-semibold tracking-wide text-[hsl(var(--muted-foreground))]";

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] shadow-[0_2px_8px_rgba(35,55,47,.035)] ${className}`}>{children}</section>;
}
function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: ReactNode }) {
  return <div className="mb-4 flex items-end justify-between gap-3"><div>{kicker && <p className="mono mb-1 text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">{kicker}</p>}<h2 className="display-font text-xl font-semibold tracking-tight">{title}</h2></div>{action}</div>;
}
function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "h-16 w-16 text-xl" : size === "sm" ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm";
  const parts = name.trim().split(/\s+/);
  return <div aria-hidden="true" className={`${dims} flex shrink-0 items-center justify-center rounded-2xl bg-[hsl(var(--accent))] font-bold text-[hsl(var(--primary))]`}>{(parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")}</div>;
}
function StatusPill({ status }: { status: string }) {
  const tone = status === "on-floor" ? "bg-emerald-100 text-emerald-800" : status === "due" ? "bg-amber-100 text-amber-900" : status === "overdue" ? "bg-rose-100 text-rose-800" : "bg-stone-100 text-stone-700";
  const words: Record<string, string> = { "on-floor": "On track", due: "Due soon", overdue: "Needs a check-in", new: "New athlete" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{words[status] ?? status}</span>;
}
function Modal({ title, children, onClose, wide = false }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => registerNativeBackHandler(onClose), [onClose]);
  return <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[hsl(160_24%_10%/.52)] p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-label={title} className={`max-h-[92dvh] w-full overflow-y-auto rounded-t-3xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-5 shadow-2xl sm:rounded-3xl ${wide ? "max-w-2xl" : "max-w-lg"}`}>
      <div className="mb-5 flex items-start justify-between gap-4"><div><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">SetStack workspace</p><h2 className="display-font mt-1 text-xl font-semibold">{title}</h2></div><button className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" onClick={onClose} aria-label="Close dialog" data-testid="button-close-dialog"><X size={18}/></button></div>
      {children}
    </div>
  </div>;
}
function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const draft = useFloor((s) => s.draft);
  const clients = useFloor((s) => s.clients);
  const [drawer, setDrawer] = useState(false);
  useEffect(() => drawer ? registerNativeBackHandler(() => setDrawer(false)) : undefined, [drawer]);
  const [notice, setNotice] = useState("");
  const storeNotice = useFloor((s) => s.notice);
  const setStoreNotice = useFloor((s) => s.setNotice);
  useEffect(() => {
    if (!storeNotice) return;
    setNotice(storeNotice);
    setStoreNotice(null);
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [storeNotice, setStoreNotice]);
  const items = [
    { href: "/", label: "Today", icon: Activity },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  const nav = <><Link href="/" data-testid="link-dashboard" className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${location === "/" ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]" : "text-[hsl(var(--sidebar-foreground))]/75 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"}`}><Activity size={17}/> Today</Link>
    <div className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground))]/45">Workspace</div>
    {items.slice(1).map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid="link-settings" className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${location === href ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]" : "text-[hsl(var(--sidebar-foreground))]/75 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"}`}><Icon size={17}/> {label}</Link>)}
    <div className="mb-2 mt-7 flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--sidebar-foreground))]/45"><span>Athletes</span><span className="mono">{clients.length}</span></div>
    <div className="max-h-[35vh] space-y-1 overflow-y-auto">{clients.slice(0, 8).map((c) => <Link key={c.id} href={`/clients/${c.id}`} data-testid={`link-athlete-${c.id}`} className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${location === `/clients/${c.id}` ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]" : "text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))]"}`}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-foreground))]/10 text-[10px] font-bold">{c.name.split(" ").map(p => p[0]).slice(0,2).join("")}</span><span className="truncate">{c.name}</span></Link>)}</div>
    <div className="mt-auto pt-8"><div className="rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))]/60 p-4"><div className="flex items-center gap-2 text-[hsl(var(--sidebar-primary))]"><ShieldCheck size={15}/><span className="text-xs font-semibold">Your data stays yours</span></div><p className="mt-2 text-xs leading-relaxed text-[hsl(var(--sidebar-foreground))]/60">Stored only {isAndroidApp()?"in this app on this device":"in this browser"}. Export a backup before switching devices.</p></div><p className="mono mt-5 text-[9px] leading-relaxed text-[hsl(var(--sidebar-foreground))]/40">SetStack · Training engine derived from GymMane · GPL-3.0</p></div></>;
  return <div className="grain min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"><aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-[hsl(var(--sidebar))] px-4 py-5 text-[hsl(var(--sidebar-foreground))] lg:flex"><Link href="/" className="mb-9 flex items-center gap-3 px-2" data-testid="link-brand"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--sidebar-primary))] text-[hsl(var(--sidebar-primary-foreground))]"><Dumbbell size={20}/></div><div><div className="display-font text-lg font-bold tracking-tight">setstack<span className="text-[hsl(var(--sidebar-primary))]">.</span></div><div className="mono text-[9px] uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground))]/45">Coach's floor</div></div></Link>{nav}</aside>
    {drawer && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setDrawer(false)}><aside onClick={e => e.stopPropagation()} className="flex h-full w-[min(84vw,300px)] flex-col bg-[hsl(var(--sidebar))] p-4 text-[hsl(var(--sidebar-foreground))]"><div className="mb-8 flex items-center justify-between"><Link href="/" className="display-font text-xl font-bold">setstack<span className="text-[hsl(var(--sidebar-primary))]">.</span></Link><button onClick={() => setDrawer(false)} aria-label="Close menu" className="p-2"><X/></button></div>{nav}</aside></div>}
    <div className="lg:pl-[248px]"><header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-4 backdrop-blur-md sm:px-7"><div className="flex items-center gap-3"><button className="rounded-lg p-2 hover:bg-[hsl(var(--muted))] lg:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)} data-testid="button-open-nav"><Menu size={19}/></button><span className="display-font text-base font-bold lg:hidden">setstack<span className="text-[hsl(var(--chart-2))]">.</span></span><span className="hidden text-sm text-[hsl(var(--muted-foreground))] sm:block">Personal training, kept in motion.</span></div><div className="flex items-center gap-2">{draft && <Link href={`/clients/${draft.clientId}`} onClick={()=>window.dispatchEvent(new Event("setstack:resume-workout"))} className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold text-[hsl(var(--secondary-foreground))]" data-testid="link-active-session"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-700"/><span className="hidden sm:inline">Session in progress</span><span className="sm:hidden">Logging</span><ArrowRight size={14}/></Link>}<div className="hidden rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] md:block"><span className="mono">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span></div></div></header><main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8"><div key={location} className="page-enter">{children}</div></main></div>
    <WorkoutDrawer/>
    {notice && <div role="status" className="fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 rounded-2xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-medium text-[hsl(var(--primary-foreground))] shadow-xl sm:bottom-6" data-testid="status-notice">{notice}</div>}
  </div>;
}

function Header({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mono mb-2 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))]">{eyebrow}</p><h1 className="display-font text-[clamp(2rem,5vw,3.15rem)] font-semibold leading-[1.05] tracking-[-.055em]">{title}</h1><p className="mt-2 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">{subtitle}</p></div>{action}</div>;
}

function Dashboard() {
  const clients = useFloor(s => s.clients);
  const startSession = useFloor(s => s.startSession);
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<"client" | null>(null);
  const [selected, setSelected] = useState("all");
  const today = todayIso();
  const todayWeekday = isoWeekday(today);
  const activeClients = clients.map(client => ({ client, summary: clientSummary(client, today) }));
  const sessionsToday = clients.flatMap(client => client.sessions.filter(s => s.date === today).map(s => ({ client, session: s })));
  const recent = clients.flatMap(client => client.sessions.map(session => ({ client, session }))).sort((a,b) => b.session.date.localeCompare(a.session.date)).slice(0,5);
  const list = activeClients.filter(({client,summary}) => (selected === "all" || summary.status === selected) && client.name.toLowerCase().includes(search.toLowerCase()));
  const weekSlot = WEEKDAYS[todayWeekday - 1] ?? "Today";
  return <><Header eyebrow={`${weekSlot} · ${new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}`} title="The floor, at a glance." subtitle="Every athlete, this week's rhythm, and the small wins worth remembering." action={<button className={primaryBtn} onClick={() => setModal("client")} data-testid="button-add-client"><Plus size={17}/> Add athlete</button>}/>
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <Card className="relative overflow-hidden p-4 sm:p-5"><div className="absolute right-4 top-4 rounded-xl bg-[hsl(var(--accent))] p-2 text-[hsl(var(--primary))]"><Users size={18}/></div><p className="mono text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">On your roster</p><div className="display-font mt-3 text-3xl font-semibold">{clients.length}<span className="ml-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">athletes</span></div><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--chart-1))]" style={{width:`${Math.min(100, clients.length*12)}%`}}/></div></Card>
      <Card className="relative overflow-hidden p-4 sm:p-5"><div className="absolute right-4 top-4 rounded-xl bg-amber-100 p-2 text-amber-800"><CalendarDays size={18}/></div><p className="mono text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Sessions today</p><div className="display-font mt-3 text-3xl font-semibold">{sessionsToday.length}<span className="ml-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">logged</span></div><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{sessionsToday.length ? sessionsToday.map(x => x.client.name.split(" ")[0]).join(", ") : "Your next check-in is a fresh start."}</p></Card>
      <Card className="relative overflow-hidden p-4 sm:p-5"><div className="absolute right-4 top-4 rounded-xl bg-rose-100 p-2 text-rose-800"><HeartPulse size={18}/></div><p className="mono text-[10px] uppercase tracking-widest text-[hsl(var(--muted-foreground))]">Need a check-in</p><div className="display-font mt-3 text-3xl font-semibold">{activeClients.filter(x => x.summary.status === "overdue").length}<span className="ml-2 text-sm font-medium text-[hsl(var(--muted-foreground))]">athletes</span></div><p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">{activeClients.filter(x => x.summary.status === "due").length} more are due soon</p></Card>
    </div>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,.8fr)]">
      <div><div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><SectionTitle kicker="Client directory" title="Your athletes"/><div className="flex flex-wrap gap-2"><input className={`${fieldClass} min-w-[155px] flex-1 sm:w-48`} placeholder="Find an athlete" aria-label="Search athletes" value={search} onChange={e=>setSearch(e.target.value)} data-testid="input-search-athletes"/><select className={`${fieldClass} w-auto`} aria-label="Filter athletes by status" value={selected} onChange={e=>setSelected(e.target.value)} data-testid="select-athlete-status"><option value="all">All status</option><option value="on-floor">On track</option><option value="due">Due soon</option><option value="overdue">Needs check-in</option><option value="new">New</option></select></div></div>
        <div className="space-y-2.5">{list.map(({client,summary})=><Card key={client.id} className="overflow-hidden transition hover:border-[hsl(var(--chart-1))]/50 hover:shadow-md"><div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"><Link href={`/clients/${client.id}`} className="flex min-w-0 flex-1 items-center gap-3" data-testid={`link-client-${client.id}`}><Avatar name={client.name}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-semibold">{client.name}</h3>{client.id.startsWith("seed-") && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-900">Demo</span>}</div><p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{client.routines.length ? client.routines.map(r=>r.name).join(" · ") : "No training plan yet"}</p></div></Link><div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end"><div className="min-w-[90px]"><p className="mono text-[10px] text-[hsl(var(--muted-foreground))]">THIS WEEK</p><div className="mt-1 flex items-center gap-2"><div className="flex gap-1">{Array.from({length:Math.min(client.weeklyGoal,6)}).map((_,i)=><span key={i} className={`h-2 w-2 rounded-full ${i<summary.weekDone?"bg-[hsl(var(--chart-1))]":"bg-[hsl(var(--muted))]"}`}/>)}</div><span className="mono text-xs">{summary.weekDone}/{client.weeklyGoal}</span></div></div><StatusPill status={summary.status}/><button onClick={()=>startSession(client.id, client.weeklyPlan[String(todayWeekday)] ?? client.routines[0]?.id ?? null)} title={`Start session for ${client.name}`} aria-label={`Start session for ${client.name}`} className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:brightness-95" data-testid={`button-start-session-${client.id}`}><Zap size={17}/></button></div></div></Card>)}
        {!list.length && <Card className="p-8 text-center"><Users className="mx-auto text-[hsl(var(--muted-foreground))]" size={24}/><h3 className="mt-3 font-semibold">{clients.length ? "No matches on this pass." : "Your floor is ready."}</h3><p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">Add an athlete to start keeping their training story together.</p><button className={`${primaryBtn} mt-4`} onClick={()=>setModal("client")} data-testid="button-empty-add-client"><Plus size={16}/> Add athlete</button></Card>}
        </div>
      </div>
      <div className="space-y-5">
        <Card className="p-5"><SectionTitle kicker="This week" title="Training rhythm"/><div className="grid grid-cols-7 gap-1.5">{WEEKDAYS.map((day,index)=>{const weekday=index+1; const planned=clients.filter(c=>!!c.weeklyPlan[String(weekday)]).length; const done=clients.filter(c=>c.sessions.some(s=>isoWeekday(s.date)===weekday && s.date>=weekStart(today) && s.date<=shiftIso(weekStart(today),6))).length; return <div key={day} className={`rounded-xl py-2 text-center ${weekday===todayWeekday?"bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]":"bg-[hsl(var(--muted))]"}`}><div className="mono text-[9px] font-semibold">{day}</div><div className="mt-2 flex justify-center gap-1"><span className={`h-1.5 w-1.5 rounded-full ${planned?"bg-[hsl(var(--chart-2))]":"bg-transparent"}`}/><span className={`h-1.5 w-1.5 rounded-full ${done?"bg-[hsl(var(--chart-1))]":"bg-transparent"}`}/></div></div>})}</div><div className="mt-4 flex gap-4 text-[10px] text-[hsl(var(--muted-foreground))]"><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[hsl(var(--chart-2))]"/>Planned</span><span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[hsl(var(--chart-1))]"/>Session logged</span></div></Card>
        <Card className="p-5"><div className="mb-4 flex items-center justify-between"><SectionTitle kicker="Latest notes" title="Recent activity"/><Activity size={18} className="text-[hsl(var(--chart-1))]"/></div>{recent.length ? <div className="space-y-4">{recent.map(({client,session})=><Link key={session.id} href={`/clients/${client.id}`} className="flex items-center gap-3" data-testid={`link-activity-${session.id}`}><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"><Dumbbell size={15}/></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{client.name} <span className="font-normal text-[hsl(var(--muted-foreground))]">· {session.name}</span></p><p className="mono mt-0.5 text-[10px] text-[hsl(var(--muted-foreground))]">{shortDate(session.date)} · {session.exercises.length} exercises</p></div><ChevronRight size={15} className="text-[hsl(var(--muted-foreground))]"/></Link>)}</div> : <p className="text-sm text-[hsl(var(--muted-foreground))]">Completed sessions will show up here.</p>}</Card>
        <Card className="overflow-hidden border-0 bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-widest opacity-55">Built for the in-between</p><h3 className="display-font mt-3 max-w-[230px] text-xl font-semibold leading-tight">Good coaching lives in the details.</h3></div><Sparkles size={19} className="text-[hsl(var(--secondary))]"/></div><p className="mt-3 text-xs leading-relaxed opacity-70">Plans, session notes and measurable progress stay close to the athlete.</p></Card>
      </div>
    </div>
    {modal && <ClientModal onClose={()=>setModal(null)}/>}
  </>;
}

function ClientModal({ onClose, client }: { onClose:()=>void; client?:Client }) {
  const addClient = useFloor(s=>s.addClient);
  const updateClient = useFloor(s=>s.updateClient);
  const unit = useFloor(s=>s.unit);
  const [error,setError] = useState("");
  const submit=(e:FormEvent<HTMLFormElement>)=>{e.preventDefault(); const f=new FormData(e.currentTarget); const name=String(f.get("name")||"").trim(); if(!name){setError("Add a name to save this athlete.");return;}
    const obj: Client = {
      id: client?.id ?? uid(), name, sex: String(f.get("sex")||"female") as Client["sex"],
      age:Number(f.get("age")||30), heightCm:Number(f.get("height")||170), weightKg:fromDisplay(Number(f.get("weight")||70),unit),
      activity:Number(f.get("activity")||1.55), weeklyGoal:Number(f.get("goal")||3),
      neckCm:f.get("neck")?Number(f.get("neck")):null, waistCm:f.get("waist")?Number(f.get("waist")):null, hipCm:f.get("hip")?Number(f.get("hip")):null,
      notes:String(f.get("notes")||""), restSeconds:client?.restSeconds??90, since:client?.since??todayIso(),
      sessions:client?.sessions??[], routines:client?.routines??[], weeklyPlan:client?.weeklyPlan??{}, bodyweight:client?.bodyweight??[],
    };
    if(client) updateClient(client.id,obj); else addClient(obj); onClose();
  };
  return <Modal title={client?"Edit athlete":"Add an athlete"} onClose={onClose} wide><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
    <div className="sm:col-span-2"><label className={labelClass} htmlFor="client-name">Athlete name</label><input id="client-name" name="name" autoFocus required defaultValue={client?.name} className={fieldClass} placeholder="First and last name" data-testid="input-client-name"/></div>
    <div><label className={labelClass} htmlFor="sex">Sex for body metrics</label><select id="sex" name="sex" className={fieldClass} defaultValue={client?.sex??"female"}><option value="female">Female</option><option value="male">Male</option></select></div>
    <div><label className={labelClass} htmlFor="age">Age</label><input id="age" name="age" type="number" min="13" max="110" defaultValue={client?.age??30} className={fieldClass}/></div>
    <div><label className={labelClass} htmlFor="height">Height (cm)</label><input id="height" name="height" type="number" min="80" max="250" defaultValue={client?.heightCm??170} className={fieldClass}/></div>
    <div><label className={labelClass} htmlFor="weight">Bodyweight ({unit})</label><input id="weight" name="weight" type="number" step="0.1" defaultValue={client?toDisplay(client.weightKg,unit).toFixed(1):70} className={fieldClass}/></div>
    <div><label className={labelClass} htmlFor="goal">Sessions per week</label><input id="goal" name="goal" type="number" min="1" max="7" defaultValue={client?.weeklyGoal??3} className={fieldClass}/></div>
    <div><label className={labelClass} htmlFor="activity-factor">Activity level</label><select id="activity-factor" name="activity" className={fieldClass} defaultValue={client?.activity??1.55}><option value="1.2">Sedentary</option><option value="1.375">Light</option><option value="1.55">Moderate</option><option value="1.725">Active</option></select></div>
    <div><label className={labelClass} htmlFor="neck">Neck (cm, optional)</label><input id="neck" name="neck" type="number" step="0.1" defaultValue={client?.neckCm??""} className={fieldClass}/></div>
    <div><label className={labelClass} htmlFor="waist">Waist (cm, optional)</label><input id="waist" name="waist" type="number" step="0.1" defaultValue={client?.waistCm??""} className={fieldClass}/></div>
    <div><label className={labelClass} htmlFor="hip">Hip (cm, optional)</label><input id="hip" name="hip" type="number" step="0.1" defaultValue={client?.hipCm??""} className={fieldClass}/></div>
    <div className="sm:col-span-2"><label className={labelClass} htmlFor="notes">Coaching notes</label><textarea id="notes" name="notes" rows={3} defaultValue={client?.notes} className={fieldClass} placeholder="Injuries, goals, cues to remember…"/></div>
    {error && <p className="text-sm text-red-700 sm:col-span-2" role="alert">{error}</p>}
    <div className="mt-2 flex justify-end gap-2 sm:col-span-2"><button type="button" className={quietBtn} onClick={onClose}>Cancel</button><button className={primaryBtn} type="submit" data-testid="button-save-client"><Check size={16}/>{client?"Save changes":"Add athlete"}</button></div>
  </form></Modal>;
}

function ClientPage() {
  const { id }=useParams<{id:string}>();
  const [,setLocation]=useLocation();
  const clients=useFloor(s=>s.clients);
  const client=clients.find(c=>c.id===id);
  const unit=useFloor(s=>s.unit);
  const assignProgram=useFloor(s=>s.assignProgram);
  const startSession=useFloor(s=>s.startSession);
  const setPlanDay=useFloor(s=>s.setPlanDay);
  const clearPlan=useFloor(s=>s.clearPlan);
  const addBodyweight=useFloor(s=>s.addBodyweight);
  const deleteRoutine=useFloor(s=>s.deleteRoutine);
  const deleteSession=useFloor(s=>s.deleteSession);
  const deleteClient=useFloor(s=>s.deleteClient);
  const [edit,setEdit]=useState(false);
  const [routineModal,setRoutineModal]=useState<Routine|null|false>(false);
  const [program,setProgram]=useState("");
  const [weight,setWeight]=useState("");
  const [tab,setTab]=useState<"overview"|"history"|"records"|"muscles">(() => new URLSearchParams(window.location.search).get("tab")==="muscles" ? "muscles" : "overview");
  useEffect(() => {
    setEdit(false);
    setRoutineModal(false);
    setProgram("");
    setWeight("");
    setTab(new URLSearchParams(window.location.search).get("tab")==="muscles" ? "muscles" : "overview");
  }, [id]);
  if(!client) return <Card className="mx-auto max-w-lg p-8 text-center"><h1 className="display-font text-2xl font-semibold">Athlete not found</h1><p className="my-3 text-sm text-[hsl(var(--muted-foreground))]">This profile may have been removed.</p><Link className={primaryBtn} href="/">Back to floor</Link></Card>;
  const summary=clientSummary(client);
  const prs=personalRecords(client);
  const latest=[...client.sessions].sort((a,b)=>b.date.localeCompare(a.date));
  const pool=exercisePool();
  const recordWeight=()=>{const value=Number(weight); if(value>0){addBodyweight(client.id,fromDisplay(value,unit));setWeight("");}};
  const removeClient=()=>{if(window.confirm(`Delete ${client.name} and all of their sessions, routines and measurements? This cannot be undone.`)){deleteClient(client.id);setLocation("/");}};
  const statusColor=summary.status==="overdue"?"text-rose-700":summary.status==="due"?"text-amber-800":"text-emerald-800";
  return <><div className="mb-4"><Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-dashboard"><ArrowLeft size={14}/>All athletes</Link></div>
    <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div className="flex min-w-0 items-center gap-4"><Avatar name={client.name} size="lg"/><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Athlete file · Since {shortDate(client.since)}</p>{client.id.startsWith("seed-")&&<span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-900">Demo profile</span>}</div><h1 className="display-font break-words text-[clamp(2rem,5vw,3rem)] font-semibold leading-none tracking-[-.05em]">{client.name}</h1><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><span>{client.age} years</span><span>·</span><span>{client.heightCm} cm</span><span>·</span><span>{formatLoad(client.weightKg,unit)}</span><span>·</span><span className={statusColor}>{summary.status==="overdue"?"Check-in overdue":summary.status==="due"?"Check-in due":"Active athlete"}</span></div></div></div><div className="flex flex-wrap gap-2"><button className={quietBtn} onClick={()=>setEdit(true)} data-testid="button-edit-client"><UserRound size={15}/>Edit profile</button><button className={`${quietBtn} text-[hsl(var(--destructive))]`} onClick={removeClient} data-testid="button-delete-client"><Trash2 size={15}/><span className="hidden sm:inline">Delete</span></button><button className={primaryBtn} onClick={()=>startSession(client.id,client.weeklyPlan[String(isoWeekday(todayIso()))]??client.routines[0]?.id??null)} data-testid="button-client-start-session"><Zap size={16}/>Start session</button></div></div>
    <div className="mb-5 grid min-w-0 grid-cols-2 gap-1 border-b border-[hsl(var(--border))] sm:flex sm:overflow-x-auto">{(["overview","history","records","muscles"] as const).map(key=><button key={key} onClick={()=>setTab(key)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold capitalize ${tab===key?"border-[hsl(var(--primary))] text-[hsl(var(--primary))]":"border-transparent text-[hsl(var(--muted-foreground))]"}`} data-testid={`tab-${key}`}>{key==="records"?"Personal records":key==="history"?"Workout history":key==="muscles"?"Muscle activity":"Overview"}</button>)}</div>
    {tab==="overview"&&<div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,.75fr)]">
      <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Card className="p-4"><div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]"><Activity size={15}/><span className="mono text-[9px] uppercase tracking-wider">Sessions this week</span></div><p className="display-font mt-3 text-3xl font-semibold">{summary.weekDone}<span className="ml-1 text-sm text-[hsl(var(--muted-foreground))]">/ {summary.weekGoal}</span></p><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Weekly target</p></Card><Card className="p-4"><div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]"><Dumbbell size={15}/><span className="mono text-[9px] uppercase tracking-wider">Lifetime sessions</span></div><p className="display-font mt-3 text-3xl font-semibold">{client.sessions.length}</p><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{summary.streak} day streak</p></Card><Card className="p-4"><div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]"><BarChart3 size={15}/><span className="mono text-[9px] uppercase tracking-wider">Top estimated 1RM</span></div><p className="display-font mt-3 truncate text-xl font-semibold">{summary.top?formatLoad(summary.top.e1rm,unit):"—"}</p><p className="mt-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">{summary.top?.name??"Log a session to begin"}</p></Card></div>
      <Card className="p-5"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><SectionTitle kicker="Training structure" title="Weekly plan"/><div className="flex items-center gap-2"><select className={`${fieldClass} max-w-[190px]`} aria-label="Choose a program template" value={program} onChange={e=>setProgram(e.target.value)} data-testid="select-program-template"><option value="">Assign program…</option>{kProgramTemplates.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select><button className={quietBtn} aria-label="Assign selected program" disabled={!program} onClick={()=>{assignProgram(client.id,program);setProgram("");}} data-testid="button-assign-program"><Plus size={15}/><span className="hidden sm:inline">Assign</span></button></div></div>
        {client.routines.length===0&&<div className="mb-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-sm text-[hsl(var(--muted-foreground))]">No plan yet. Assign a template or build an individual routine.</div>}
        <div className="grid gap-2 sm:grid-cols-2">{WEEKDAYS.map((day,index)=>{const rid=client.weeklyPlan[String(index+1)];const routine=client.routines.find(r=>r.id===rid);return <div key={day} className="flex items-center gap-2 rounded-xl bg-[hsl(var(--background))] p-2.5"><span className="w-8 text-[11px] font-bold text-[hsl(var(--muted-foreground))]">{day}</span><select aria-label={`${day} training plan`} className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none" value={rid??""} onChange={e=>setPlanDay(client.id,index+1,e.target.value||null)} data-testid={`select-plan-${index+1}`}><option value="">Rest day</option>{client.routines.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>{routine&&<button aria-label={`Start ${routine.name}`} className="rounded-lg p-1.5 text-[hsl(var(--chart-1))] hover:bg-[hsl(var(--accent))]" onClick={()=>startSession(client.id,routine.id)} data-testid={`button-plan-start-${index+1}`}><Zap size={15}/></button>}</div>})}</div>
        <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-[hsl(var(--border))] pt-4"><button className="text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={()=>clearPlan(client.id)} data-testid="button-clear-plan">Clear weekly plan</button><button className={`${quietBtn} min-h-9 px-3`} onClick={()=>setRoutineModal(null)} data-testid="button-new-routine"><Plus size={14}/>New routine</button></div>
      </Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><SectionTitle kicker="Individual sessions" title="Routines"/><ClipboardList size={18} className="text-[hsl(var(--chart-1))]"/></div>{client.routines.length?<div className="space-y-2">{client.routines.map(r=><div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] p-3" data-testid={`routine-${r.id}`}><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{r.name}</h3><p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{r.group||"Custom"} · {r.exerciseIds.length} exercises · {Object.values(r.sets).reduce((a,b)=>a+b,0)} sets</p></div><div className="flex shrink-0 gap-1"><button onClick={()=>startSession(client.id,r.id)} aria-label={`Start ${r.name}`} className="rounded-lg bg-[hsl(var(--accent))] p-2 text-[hsl(var(--primary))]" data-testid={`button-start-routine-${r.id}`}><Zap size={15}/></button><button onClick={()=>setRoutineModal(r)} aria-label={`Edit ${r.name}`} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" data-testid={`button-edit-routine-${r.id}`}><MoreHorizontal size={16}/></button></div></div>)}</div>:<p className="text-sm text-[hsl(var(--muted-foreground))]">Routines assigned to this athlete will appear here.</p>}</Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><SectionTitle kicker="Body metrics" title="Bodyweight"/><Weight size={18} className="text-[hsl(var(--chart-1))]"/></div><div className="mb-4 flex items-end gap-2"><div className="flex-1"><label className={labelClass} htmlFor="record-weight">Record new measurement ({unit})</label><input id="record-weight" type="number" step=".1" value={weight} onChange={e=>setWeight(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();recordWeight()}}} className={fieldClass} placeholder={toDisplay(client.weightKg,unit).toFixed(1)} data-testid="input-bodyweight"/></div><button className={primaryBtn} onClick={recordWeight} disabled={!weight||Number(weight)<=0} data-testid="button-add-bodyweight"><Plus size={15}/><span className="hidden sm:inline">Record</span></button></div>{client.bodyweight.length?<div className="space-y-2">{client.bodyweight.slice(-5).reverse().map((m,i)=><div key={`${m.date}-${i}`} className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-2 text-sm"><span className="text-[hsl(var(--muted-foreground))]">{shortDate(m.date)}</span><span className="mono font-medium">{formatLoad(m.kg,unit)}</span></div>)}</div>:<p className="text-xs text-[hsl(var(--muted-foreground))]">Measurements appear as you record them.</p>}</Card>
      <Card className="p-5"><SectionTitle kicker="Coach's notes" title="Remember this"/><p className="whitespace-pre-wrap text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{client.notes||"No coaching notes yet. Edit the profile to add cues, goals or context."}</p><div className="mt-4 flex items-center gap-2 border-t border-[hsl(var(--border))] pt-3 text-[10px] text-[hsl(var(--muted-foreground))]"><CircleHelp size={13}/>A note to your future self, before the next session.</div></Card>
      </div>
      <div className="space-y-5"><Card className="p-5"><SectionTitle kicker="Recent work" title="Latest sessions" action={<button className="text-xs font-semibold text-[hsl(var(--chart-1))]" onClick={()=>setTab("history")} data-testid="button-see-history">All history <ArrowRight className="ml-1 inline" size={13}/></button>}/>{latest.length?<div className="space-y-3">{latest.slice(0,4).map(s=><div key={s.id} className="border-b border-[hsl(var(--border))] pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">{s.name}</p><p className="mono mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{shortDate(s.date)} · {s.exercises.length} lifts</p></div><p className="mono text-xs text-[hsl(var(--muted-foreground))]">{Math.round(s.durationSec/60)} min</p></div></div>)}</div>:<p className="text-sm text-[hsl(var(--muted-foreground))]">No sessions recorded yet.</p>}</Card>
        <Card className="border-0 bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]"><p className="mono text-[10px] uppercase tracking-[.16em] opacity-60">Coach's focus</p><p className="display-font mt-2 text-xl font-semibold">{summary.status==="overdue"?"Reconnect with "+client.name.split(" ")[0]:summary.top?`${summary.top.name} is the current high mark.`:"Set the first marker."}</p><p className="mt-2 text-xs leading-relaxed opacity-70">{summary.status==="overdue"?"A short check-in can bring the plan back into focus.":summary.top?`Estimated 1RM ${formatLoad(summary.top.e1rm,unit)}. Small progress adds up.`:"Start a session and SetStack will keep track of the work."}</p></Card>
      </div>
    </div>}
    {tab==="history"&&<div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><Card className="p-5"><SectionTitle kicker="Training log" title="Workout history"/>{latest.length?<div className="space-y-3">{latest.map(session=><details key={session.id} className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"><Dumbbell size={17}/></div><div className="min-w-0 flex-1"><p className="font-semibold">{session.name}</p><p className="mono mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{shortDate(session.date)} · {Math.round(session.durationSec/60)} min · {session.exercises.length} exercises</p></div><ChevronDown size={16} className="transition group-open:rotate-180"/></summary><div className="space-y-3 border-t border-[hsl(var(--border))] px-4 py-3">{session.exercises.map(ex=><div key={ex.id}><div className="flex justify-between text-sm font-semibold"><span>{ex.name}</span><span className="mono text-xs">{formatLoad(bestSetOneRm(ex.sets),unit)} e1RM</span></div><div className="mt-1 flex flex-wrap gap-1.5">{ex.sets.map((set,i)=><span key={set.id} className="rounded-md bg-[hsl(var(--muted))] px-2 py-1 mono text-[10px]">{i+1} · {formatLoad(set.weight,unit)} × {set.reps}{set.rpe!=null?` · RIR ${(10-set.rpe).toFixed(set.rpe%1?1:0)}`:""}{set.kind!=="normal"?` · ${set.kind}`:""}</span>)}</div></div>)}<button className="mt-1 text-xs font-medium text-[hsl(var(--destructive))]" onClick={()=>{if(window.confirm("Delete this workout from the training history?"))deleteSession(client.id,session.id)}} data-testid={`button-delete-session-${session.id}`}>Delete this session</button></div></details>)}</div>:<div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Completed sessions will appear here. Start a workout to add the first one.</div>}</Card>
      <Card className="p-5"><SectionTitle kicker="Body metrics" title="Measurement timeline"/>{client.bodyweight.length?<div className="space-y-3">{[...client.bodyweight].reverse().map((m,index)=><div key={`${m.date}-${index}`} className="flex items-center gap-3"><div className="mono w-14 text-xs text-[hsl(var(--muted-foreground))]">{shortDate(m.date)}</div><div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--chart-1))]" style={{width:`${Math.max(10,Math.min(100,(m.kg/120)*100))}%`}}/></div><span className="mono w-16 text-right text-xs">{formatLoad(m.kg,unit)}</span></div>)}</div>:<p className="text-sm text-[hsl(var(--muted-foreground))]">Add measurements to build a timeline.</p>}</Card></div>}
    {tab==="records"&&<Card className="p-5"><SectionTitle kicker="All-time best estimated one-rep max" title="Personal records"/>{prs.length?<div className="grid gap-3 md:grid-cols-2">{prs.map((pr,index)=><div key={pr.id} className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4" data-testid={`record-${pr.id}`}><div className="absolute right-4 top-4 mono text-[10px] text-[hsl(var(--muted-foreground))]">#{String(index+1).padStart(2,"0")}</div><p className="max-w-[75%] text-sm font-semibold">{pr.name}</p><div className="display-font mt-3 text-3xl font-semibold">{formatLoad(pr.e1rm,unit)}</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatLoad(pr.weight,unit)} × {pr.reps} reps · {pr.date} · {pr.method.toUpperCase()} estimate</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--chart-2))]" style={{width:`${Math.min(100,pr.e1rm/(prs[0]?.e1rm??1)*100)}%`}}/></div></div>)}</div>:<div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">PRs are estimated from logged work sets. Warm-up sets don't count.</div>}</Card>}
    {tab==="muscles"&&<MuscleActivityDashboard client={client}/>}
    {edit&&<ClientModal client={client} onClose={()=>setEdit(false)}/>}
    {routineModal!==false&&<RoutineModal client={client} routine={routineModal||undefined} pool={pool} onClose={()=>setRoutineModal(false)} onDelete={routineModal?()=>{if(window.confirm(`Delete routine "${routineModal.name}"? Weekly plan assignments will also be cleared.`)){deleteRoutine(client.id,routineModal.id);setRoutineModal(false)}}:undefined}/>}
  </>;
}

function RoutineModal({ client, routine, pool, onClose, onDelete }: {client:Client;routine?:Routine;pool:CatalogExercise[];onClose:()=>void;onDelete?:()=>void}) {
  const saveRoutine=useFloor(s=>s.saveRoutine);
  const savedCustom=useFloor(s=>s.custom);
  const [name,setName]=useState(routine?.name??"");
  const [group,setGroup]=useState(routine?.group??"Custom");
  const [exerciseIds,setExerciseIds]=useState<string[]>(routine?.exerciseIds??[]);
  const [filter,setFilter]=useState("");
  const [error,setError]=useState("");
  const available=[...pool.filter(ex=>!savedCustom.some(custom=>custom.id===ex.id)),...savedCustom];
  const selected=available.filter(e=>exerciseIds.includes(e.id));
  const matches=available.filter(e=>e.name.toLowerCase().includes(filter.toLowerCase())||e.primary.toLowerCase().includes(filter.toLowerCase())).slice(0,12);
  const updateCount=(id:string,value:number)=>setCounts(c=>({...c,[id]:Math.max(1,value)}));
  const [counts,setCounts]=useState<Record<string,number>>(routine?.sets??{});
  const [restTimes,setRestTimes]=useState<Record<string,number>>(routine?.rest??{});
  const submit=(e:FormEvent)=>{e.preventDefault();if(!name.trim()){setError("Give this routine a name.");return;} const next:Routine={id:routine?.id??uid(),name:name.trim(),group:group.trim()||"Custom",exerciseIds,sets:counts,plan:routine?.plan??{},rest:restTimes};saveRoutine(client.id,next);onClose();};
  return <Modal title={routine?"Edit routine":"Build a routine"} onClose={onClose} wide><form onSubmit={submit}>
    <div className="grid gap-3 sm:grid-cols-2"><div><label className={labelClass} htmlFor="routine-name">Routine name</label><input id="routine-name" className={fieldClass} value={name} onChange={e=>setName(e.target.value)} placeholder="Upper body A" data-testid="input-routine-name"/></div><div><label className={labelClass} htmlFor="routine-group">Program / group</label><input id="routine-group" className={fieldClass} value={group} onChange={e=>setGroup(e.target.value)} placeholder="Strength block"/></div></div>
    <div className="mt-5"><label className={labelClass} htmlFor="exercise-search">Add exercises</label><input id="exercise-search" className={fieldClass} value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Search exercise library" data-testid="input-exercise-search"/><div className="mt-2 grid max-h-36 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">{matches.map(ex=><button type="button" key={ex.id} disabled={exerciseIds.includes(ex.id)} onClick={()=>{setExerciseIds(ids=>ids.includes(ex.id)?ids:[...ids,ex.id]);setCounts(c=>({...c,[ex.id]:c[ex.id]??3}));}} className="flex items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs hover:bg-[hsl(var(--muted))] disabled:opacity-40" data-testid={`button-add-exercise-${ex.id}`}><span>{ex.name}<span className="ml-1 text-[10px] text-[hsl(var(--muted-foreground))]">{ex.equipment}</span></span><Plus size={13}/></button>)}</div>
      <CustomExerciseMuscles onCreated={created=>{setExerciseIds(ids=>ids.includes(created.id)?ids:[...ids,created.id]);setCounts(c=>({...c,[created.id]:3}));}}/>
    </div>
    <div className="mt-5"><p className={labelClass}>Routine exercises · targets & rest</p>{selected.length?<div className="space-y-2">{selected.map((ex,index)=><div key={ex.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-[hsl(var(--background))] p-2.5"><span className="mono w-6 text-[10px] text-[hsl(var(--muted-foreground))]">{String(index+1).padStart(2,"0")}</span><span className="min-w-[120px] flex-1 truncate text-sm font-medium">{ex.name}</span><label className="mono flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">SETS<input aria-label={`${ex.name} set count`} className={`${fieldClass} w-14 px-1.5 py-1.5 text-center`} type="number" min="1" max="20" value={counts[ex.id]??3} onChange={e=>updateCount(ex.id,Number(e.target.value))} data-testid={`input-routine-sets-${ex.id}`}/></label><label className="mono flex items-center gap-1.5 text-[10px] text-[hsl(var(--muted-foreground))]">REST<input aria-label={`${ex.name} rest seconds`} className={`${fieldClass} w-16 px-1.5 py-1.5 text-center`} type="number" min="0" max="600" step="15" value={restTimes[ex.id]??90} onChange={e=>setRestTimes(times=>({...times,[ex.id]:Math.min(600,Math.max(0,Number(e.target.value)))}))} data-testid={`input-routine-rest-${ex.id}`}/><span>s</span></label><button type="button" aria-label={`Remove ${ex.name}`} className="rounded-lg p-2 text-[hsl(var(--destructive))] hover:bg-rose-50" onClick={()=>setExerciseIds(ids=>ids.filter(id=>id!==ex.id))} data-testid={`button-remove-exercise-${ex.id}`}><X size={15}/></button></div>)}</div>:<p className="rounded-xl border border-dashed border-[hsl(var(--border))] p-4 text-center text-xs text-[hsl(var(--muted-foreground))]">Choose exercises from the library above.</p>}</div>
    {error&&<p className="mt-3 text-sm text-red-700" role="alert">{error}</p>}
    <div className="mt-5 flex flex-wrap justify-between gap-2 border-t border-[hsl(var(--border))] pt-4">{onDelete?<button type="button" className={`${quietBtn} text-[hsl(var(--destructive))]`} onClick={onDelete} data-testid="button-delete-routine"><Trash2 size={14}/>Delete routine</button>:<span/>}<div className="ml-auto flex gap-2"><button type="button" className={quietBtn} onClick={onClose}>Cancel</button><button className={primaryBtn} type="submit" data-testid="button-save-routine"><Check size={15}/>Save routine</button></div></div>
  </form></Modal>;
}

function WorkoutDrawer() {
  const draft=useFloor(s=>s.draft);
  const clients=useFloor(s=>s.clients);
  const unit=useFloor(s=>s.unit);
  const logSet=useFloor(s=>s.logSet);
  const setActive=useFloor(s=>s.setActive);
  const addDraftExercise=useFloor(s=>s.addDraftExercise);
  const removeDraftExercise=useFloor(s=>s.removeDraftExercise);
  const removeSet=useFloor(s=>s.removeSet);
  const finishSession=useFloor(s=>s.finishSession);
  const discardDraft=useFloor(s=>s.discardDraft);
  const [kind,setKind]=useState<"normal"|"warmup">("normal");
  const [weight,setWeight]=useState("");
  const [reps,setReps]=useState("");
  const [rir,setRir]=useState("");
  const [showAdd,setShowAdd]=useState(false);
  const [minimized,setMinimized]=useState(false);
  useEffect(()=>setMinimized(false),[draft?.startedAt,draft?.clientId]);
  useEffect(()=>{
    const resume=()=>setMinimized(false);
    window.addEventListener("setstack:resume-workout",resume);
    return()=>window.removeEventListener("setstack:resume-workout",resume);
  },[]);
  useEffect(()=>draft&&!minimized ? registerNativeBackHandler(()=>setMinimized(true)) : undefined,[draft?.startedAt,minimized]);
  const [exerciseSearch,setExerciseSearch]=useState("");
  const client=draft?clients.find(c=>c.id===draft.clientId):undefined;
  const active=draft?.exercises[draft.activeIndex];
  const pool=exercisePool();
  useEffect(()=>{if(!draft||!client||!active)return;const prev=suggestSet(client,active.id,active.sets,unit);setWeight(String(Number(toDisplay(prev.weightKg,unit).toFixed(1))));setReps(String(prev.reps));setRir(prev.rpe==null?"":String(Number((10-prev.rpe).toFixed(1))));},[draft?.activeIndex,draft?.clientId,active?.id,unit]);
  if(!draft||!client)return null;
  if(minimized) return <button onClick={()=>setMinimized(false)} className={`${primaryBtn} fixed bottom-4 right-4 z-40 shadow-xl`} data-testid="button-resume-session"><Dumbbell size={16}/>Resume workout · {draft.exercises.reduce((n,e)=>n+e.sets.length,0)} sets</button>;
  const submit=(e:FormEvent)=>{e.preventDefault();const w=Number(weight);const r=Number(reps);if(!active||r<1||w<0)return;logSet({reps:r,weight:fromDisplay(w,unit),kind,rpe:rir===""?null:10-Number(rir)});setKind("normal");};
  const recordsFor=active?lastPerformance(client,active.id):null;
  const oldBest=active?personalRecords(client).find(p=>p.id===active.id):undefined;
  const filtered=pool.filter(e=>e.name.toLowerCase().includes(exerciseSearch.toLowerCase())).slice(0,10);
  return <div className="fixed inset-x-0 bottom-0 z-40 max-h-[88dvh] overflow-y-auto border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] shadow-[0_-12px_45px_rgba(32,50,43,.18)] sm:inset-x-auto sm:bottom-4 sm:right-4 sm:w-[min(560px,calc(100vw-2rem))] sm:rounded-3xl sm:border sm:shadow-2xl" data-testid="panel-workout-logger">
    <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-4 py-3 backdrop-blur"><div className="min-w-0"><div className="mono break-words text-[9px] uppercase tracking-[.18em] text-[hsl(var(--chart-1))]">Live session · {client.name}</div><h2 className="display-font mt-0.5 text-lg font-semibold">{draft.name}</h2></div><div className="flex shrink-0 gap-1"><button className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" onClick={()=>setShowAdd(!showAdd)} aria-label="Add exercise" data-testid="button-logger-add-exercise"><Plus size={17}/></button><button className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" onClick={()=>setMinimized(true)} aria-label="Minimize workout without discarding it" data-testid="button-minimize-session"><ChevronDown size={17}/></button><button className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" onClick={()=>{if(window.confirm("Discard this unfinished workout?"))discardDraft()}} aria-label="Discard workout" data-testid="button-discard-session"><X size={17}/></button></div></div>
    <div className="p-4 sm:p-5">
      {showAdd&&<div className="mb-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3"><label className={labelClass} htmlFor="logger-exercise-search">Find an exercise</label><input id="logger-exercise-search" className={fieldClass} value={exerciseSearch} onChange={e=>setExerciseSearch(e.target.value)} placeholder="Type an exercise" data-testid="input-logger-exercise"/><div className="mt-2 max-h-32 overflow-y-auto">{filtered.map(ex=><button key={ex.id} className="block w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-[hsl(var(--muted))]" onClick={()=>{addDraftExercise(ex);setShowAdd(false);setExerciseSearch("")}} data-testid={`button-logger-exercise-${ex.id}`}>{ex.name}</button>)}</div></div>}
      {draft.exercises.length===0?<div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-6 text-center"><Dumbbell className="mx-auto text-[hsl(var(--muted-foreground))]" size={24}/><p className="mt-2 text-sm font-semibold">Make this session yours</p><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Add the first exercise to start logging.</p><button className={`${primaryBtn} mt-3`} onClick={()=>setShowAdd(true)}><Plus size={15}/>Add exercise</button></div>:<>
        <div className="mb-4 flex gap-2 overflow-x-auto">{draft.exercises.map((ex,index)=><button key={`${ex.id}-${index}`} onClick={()=>setActive(index)} className={`shrink-0 rounded-xl px-3 py-2 text-left text-xs ${index===draft.activeIndex?"bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]":"bg-[hsl(var(--muted))]"}`} data-testid={`button-select-logger-exercise-${index}`}><span className="block max-w-36 truncate font-semibold">{ex.name}</span><span className="mono mt-1 block opacity-70">{ex.sets.length} sets</span></button>)}</div>
        {active&&<><div className="mb-3 flex items-start justify-between"><div><h3 className="display-font text-xl font-semibold">{active.name}</h3><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{recordsFor?`Last: ${shortDate(recordsFor.date)} · ${recordsFor.sets.map(s=>`${formatLoad(s.weight,unit)} × ${s.reps}`).join(" / ")}`:"No previous performance"}{oldBest&&` · PR ${formatLoad(oldBest.e1rm,unit)} e1RM`}</p></div><button className="rounded-lg p-2 text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]" onClick={()=>{if(window.confirm(`Remove ${active.name} from this session?`))removeDraftExercise(draft.activeIndex)}} aria-label={`Remove ${active.name}`} data-testid="button-remove-draft-exercise"><Trash2 size={15}/></button></div>
          {!!active.sets.length&&<div className="mb-3 space-y-1.5">{active.sets.map((set,index)=><div key={set.id} className="flex items-center gap-2 rounded-lg bg-[hsl(var(--background))] px-3 py-2 text-xs"><span className="mono w-6 text-[hsl(var(--muted-foreground))]">{String(index+1).padStart(2,"0")}</span><span className="flex-1 font-medium">{formatLoad(set.weight,unit)} × {set.reps}<span className="ml-2 text-[hsl(var(--muted-foreground))]">{set.kind==="warmup"?"Warm-up":set.rpe==null?"":`RIR ${(10-set.rpe).toFixed(set.rpe%1?1:0)}`}</span></span><button onClick={()=>removeSet(draft.activeIndex,set.id)} aria-label={`Remove set ${index+1}`} className="p-1 text-[hsl(var(--muted-foreground))]" data-testid={`button-remove-set-${set.id}`}><X size={14}/></button></div>)}</div>}
          <div className="mb-3 flex rounded-lg bg-[hsl(var(--muted))] p-1"><button onClick={()=>setKind("normal")} className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${kind==="normal"?"bg-[hsl(var(--card))] shadow-sm":""}`} data-testid="button-set-kind-work">Work set</button><button onClick={()=>setKind("warmup")} className={`flex-1 rounded-md py-1.5 text-xs font-semibold ${kind==="warmup"?"bg-[hsl(var(--card))] shadow-sm":""}`} data-testid="button-set-kind-warmup">Warm-up</button></div>
          <form onSubmit={submit}><div className="grid grid-cols-3 gap-2"><div><label className={labelClass} htmlFor="set-weight">Load · {unit}</label><input id="set-weight" className={fieldClass} type="number" min="0" step=".5" inputMode="decimal" value={weight} onChange={e=>setWeight(e.target.value)} data-testid="input-set-weight"/></div><div><label className={labelClass} htmlFor="set-reps">Reps</label><input id="set-reps" className={fieldClass} type="number" min="1" max="100" inputMode="numeric" value={reps} onChange={e=>setReps(e.target.value)} data-testid="input-set-reps"/></div><div><label className={labelClass} htmlFor="set-rir">RIR <span className="font-normal">(optional)</span></label><input id="set-rir" className={fieldClass} type="number" min="0" max="10" step=".5" inputMode="decimal" value={rir} onChange={e=>setRir(e.target.value)} placeholder="—" data-testid="input-set-rir"/></div></div><button type="submit" disabled={!reps||Number(reps)<1} className={`${primaryBtn} mt-3 w-full`} data-testid="button-log-set"><Plus size={16}/>Log {kind==="warmup"?"warm-up":"work"} set</button></form></>}
      </>}
      <div className="mt-4 flex items-center justify-between border-t border-[hsl(var(--border))] pt-3"><p className="mono text-[10px] text-[hsl(var(--muted-foreground))]">{draft.exercises.reduce((n,e)=>n+e.sets.length,0)} sets logged</p><button className={`${primaryBtn} min-h-9`} onClick={()=>{const result=finishSession();if(result){}}} data-testid="button-finish-session"><Check size={15}/>Finish workout</button></div>
    </div>
  </div>;
}

function SettingsPage() {
  const unit=useFloor(s=>s.unit);
  const setUnit=useFloor(s=>s.setUnit);
  const exportBackup=useFloor(s=>s.exportBackup);
  const importBackup=useFloor(s=>s.importBackup);
  const resetDemo=useFloor(s=>s.resetDemo);
  const [status,setStatus]=useState("");
  const [exporting,setExporting]=useState(false);
  const native=isAndroidApp();
  const [restoreText,setRestoreText]=useState("");
  const [confirmRestore,setConfirmRestore]=useState(false);
  const fileRef=useRef<HTMLInputElement>(null);
  const clients=useFloor(s=>s.clients);
  const exportFile=async()=>{
    if(exporting)return;
    setExporting(true);
    try {
      const mode=await exportBackupFile(exportBackup(),`setstack-backup-${todayIso()}.json`);
      setStatus(mode==="android"?"Backup prepared for sharing. Keep a saved copy outside SetStack; the app's temporary copy is only a cache.":"Backup downloaded. Keep it somewhere safe.");
    } catch(error) {setStatus(`Could not export the backup: ${error instanceof Error?error.message:String(error)}`);}
    finally {setExporting(false);}
  };
  const readFile=(file?:File)=>{if(!file)return;const reader=new FileReader();reader.onload=()=>{setRestoreText(String(reader.result??""));setConfirmRestore(true)};reader.onerror=()=>setStatus("Could not read that file. Try another JSON backup.");reader.readAsText(file);};
  const restore=()=>{const error=importBackup(restoreText);if(error)setStatus(error);else setStatus("Backup restored on this device.");setConfirmRestore(false);setRestoreText("");};
  const reset=()=>{if(window.confirm("Reset all local data to the original demo floor? This replaces your current athletes and sessions.")){resetDemo();setStatus("Demo data restored.");}};
  return <><Header eyebrow="Workspace preferences" title="Keep your data close." subtitle="Set your working units and make a portable copy of the training floor."/>
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
      <div className="space-y-5"><Card className="p-5 sm:p-6"><SectionTitle kicker="Display preferences" title="Training units"/><p className="mb-4 max-w-lg text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Choose how loads appear in the workspace. Stored values stay in kilograms so your training history remains consistent.</p><div className="flex max-w-sm gap-2 rounded-xl bg-[hsl(var(--muted))] p-1"><button onClick={()=>setUnit("kg")} className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${unit==="kg"?"bg-[hsl(var(--card))] shadow-sm":""}`} data-testid="button-unit-kg">Kilograms · kg</button><button onClick={()=>setUnit("lb")} className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${unit==="lb"?"bg-[hsl(var(--card))] shadow-sm":""}`} data-testid="button-unit-lb">Pounds · lb</button></div></Card>
        <Card className="p-5 sm:p-6"><SectionTitle kicker="Portable data" title="Backup & restore"/><p className="mb-5 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Your workspace is saved only in {native?"this app's":"this browser's"} local storage. Export a JSON backup regularly; importing it replaces the current athletes on this device.{native&&" Browser and APK storage are separate: import your browser backup to transfer clients."}</p><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"><ArrowDownToLine size={19}/></div><h3 className="mt-3 font-semibold">Export a backup</h3><p className="mt-1 min-h-[36px] text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{native?"Save or share":"Download"} every athlete, routine and session as JSON.</p><button className={`${quietBtn} mt-4 w-full`} onClick={exportFile} disabled={exporting} data-testid="button-export-backup"><ArrowDownToLine size={15}/>{exporting?"Preparing…":native?"Save / share JSON":"Download JSON"}</button></div>
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-900"><FileUp size={19}/></div><h3 className="mt-3 font-semibold">Restore a backup</h3><p className="mt-1 min-h-[36px] text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Choose a SetStack JSON file to restore this browser.</p><input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e=>readFile(e.target.files?.[0])} data-testid="input-backup-file"/><button className={`${quietBtn} mt-4 w-full`} onClick={()=>fileRef.current?.click()} data-testid="button-import-backup"><FileUp size={15}/>Choose JSON</button></div></div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/60 bg-amber-50 p-3 text-xs leading-relaxed text-amber-950"><CircleHelp className="mt-0.5 shrink-0" size={15}/><span>Backups include personal coaching notes and measurements. Store the file somewhere private.</span></div>
          {status&&<p role="status" className="mt-4 rounded-xl bg-[hsl(var(--accent))] px-3 py-2 text-sm" data-testid="status-settings">{status}</p>}
        </Card></div>
      <div className="space-y-5"><Card className="overflow-hidden"><div className="bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-widest opacity-60">Local-first by design</p><h2 className="display-font mt-3 text-2xl font-semibold">One browser.<br/>Your whole floor.</h2></div><ShieldCheck size={22} className="text-[hsl(var(--secondary))]"/></div><p className="mt-3 max-w-sm text-sm leading-relaxed opacity-75">SetStack works without an internet service. It does not use an account or sync data to the cloud.</p></div><div className="space-y-3 p-5"><div className="flex items-center gap-3 text-sm"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]"><Users size={15}/></span><span className="flex-1">Athletes on this browser</span><span className="mono font-semibold">{clients.length}</span></div><div className="flex items-center gap-3 text-sm"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]"><ClipboardList size={15}/></span><span className="flex-1">Training sessions saved</span><span className="mono font-semibold">{clients.reduce((n,c)=>n+c.sessions.length,0)}</span></div></div></Card>
        <Card className="border-[hsl(var(--destructive))]/25 p-5"><p className="mono text-[10px] uppercase tracking-widest text-[hsl(var(--destructive))]">Demo data</p><h3 className="display-font mt-2 text-lg font-semibold">Reset the demo floor</h3><p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">The starter athletes are clearly marked as demo. Reset brings the original examples back and removes local changes.</p><button onClick={reset} className={`${quietBtn} mt-4 text-[hsl(var(--destructive))]`} data-testid="button-reset-demo"><Activity size={15}/>Reset demo data</button></Card>
        <div className="px-1 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">Training engine derived from GymMane by InlitX and contributors. Licensed under GNU GPL-3.0. See included LICENSE and third_party/gymmane/NOTICE.</div>
      </div>
    </div>
    {confirmRestore&&<Modal title="Replace this browser's data?" onClose={()=>{setConfirmRestore(false);setRestoreText("")}}><div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950"><strong>Restore replaces your current athlete list and sessions.</strong><br/>This cannot be undone unless you exported a backup first. Confirm only if this is the file you want.</div><div className="mt-5 flex justify-end gap-2"><button className={quietBtn} onClick={()=>{setConfirmRestore(false);setRestoreText("")}}>Cancel</button><button className={`${btn} bg-[hsl(var(--destructive))] text-white`} onClick={restore} data-testid="button-confirm-restore"><FileUp size={15}/>Replace & restore</button></div></Modal>}
  </>;
}

function NotFoundPage() {
  return <Card className="mx-auto max-w-lg p-8 text-center"><div className="mono text-xs text-[hsl(var(--muted-foreground))]">404 · Off the floor</div><h1 className="display-font mt-3 text-3xl font-semibold">This page isn't in the plan.</h1><Link href="/" className={`${primaryBtn} mt-5`} data-testid="link-not-found-home">Back to today</Link></Card>;
}

function App() {
  const [hydrated,setHydrated]=useState(false);
  useEffect(()=>{let mounted=true;Promise.resolve(useFloor.persist.rehydrate()).finally(()=>{if(mounted)setHydrated(true)});return()=>{mounted=false}},[]);
  if(!hydrated) return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] p-6"><div className="w-full max-w-sm"><div className="mb-5 h-8 w-36 animate-pulse rounded-lg bg-[hsl(var(--muted))]"/><div className="h-36 animate-pulse rounded-2xl bg-[hsl(var(--muted))]"/><div className="mt-4 h-20 animate-pulse rounded-2xl bg-[hsl(var(--muted))]"/></div></div>;
  return <AppShell><Switch><Route path="/" component={Dashboard}/><Route path="/clients/:id" component={ClientPage}/><Route path="/settings" component={SettingsPage}/><Route component={NotFoundPage}/></Switch></AppShell>;
}

export default App;
