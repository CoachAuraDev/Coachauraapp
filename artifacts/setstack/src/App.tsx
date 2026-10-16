import { lazy, Suspense, useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, Route, Switch, useLocation, useParams, useSearch } from "wouter";
import {
  Activity, ArrowLeft, ArrowRight, BarChart3, CalendarDays, Check,
  ChevronDown, ChevronRight, CircleHelp, ClipboardList, Dumbbell, FileUp,
  HeartPulse, Menu, MoreHorizontal, Plus, Settings, ShieldCheck, Sparkles, Trash2,
  UserRound, Users, Weight, X, Zap,
} from "lucide-react";
import { useFloor, exercisePool } from "@/lib/gymmane/store";
import type { Client, Routine, SessionLog } from "@/lib/gymmane/models";
import { fromDisplay, formatLoad, isoWeekday, shortDate, shiftIso, todayIso, toDisplay, uid, weekStart, WEEKDAYS } from "@/lib/gymmane/engine";
import { clientSummary, personalRecords, bestSetOneRm } from "@/lib/gymmane/metrics";
import { TrainerDashboard } from "@/components/trainer-dashboard";
import { CustomExerciseMuscles } from "@/components/custom-exercise-muscles";
import { Modal, fieldClass, btn, primaryBtn, quietBtn, labelClass } from "@/components/workout/shared";
import { WorkoutDrawer } from "@/components/workout/workout-logger";
import { BackupRestoreDialog, exportOriginalStorage } from "@/components/backup-restore";
import { BackupExportAction, BackupStatusText, useBackupReminder } from "@/components/backup-reminder";
import { PersistenceStatus, usePersistenceHealth } from "@/components/persistence-status";
import { MAX_BACKUP_BYTES } from "@/lib/gymmane/backup";
import { TemplateAssign } from "@/components/workout/template-assign";
import { registerNativeBackHandler } from "@/lib/native/back-handlers";
import { isAndroidApp } from "@/lib/native/android";
import { billingController, initializePlayBilling } from "@/lib/billing/controller";
import { FREE_CLIENT_LIMIT } from "@/lib/billing/entitlement";
import { LifetimePaywall, useBillingSnapshot } from "@/components/lifetime-paywall";
import { BrandLockup } from "@/components/brand-lockup";
import PrivacyPolicyPage from "@/pages/privacy-policy";
import { APPEARANCE_THEMES } from "@/lib/gymmane/appearance";

const RoutineModal = lazy(() => import("@/components/workout/routine-editor").then((module) => ({ default: module.RoutineModal })));
const SessionEditor = lazy(() => import("@/components/workout/session-editor").then((module) => ({ default: module.SessionEditor })));
const MuscleActivityDashboard = lazy(() => import("@/components/muscle-activity-dashboard").then((module) => ({ default: module.MuscleActivityDashboard })));
const ClientOverviewVisualizations = lazy(() => import("@/components/client-overview-visualizations").then((module) => ({ default: module.ClientOverviewVisualizations })));

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
  const tone = status === "on-floor" ? "bg-[var(--status-on-floor-background)] text-[var(--status-on-floor-foreground)]" : status === "due" ? "bg-[hsl(38_90%_55%/.16)] text-[hsl(38_95%_70%)]" : status === "overdue" ? "bg-[hsl(0_80%_60%/.16)] text-[hsl(0_90%_75%)]" : "bg-[hsl(240_5%_20%)] text-[hsl(240_5%_66%)]";
  const words: Record<string, string> = { "on-floor": "On track", due: "Due soon", overdue: "Needs a check-in", new: "New athlete" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${tone}`}>{words[status] ?? status}</span>;
}
function useConfirm(): [(o:{title:string;message:string;confirmLabel:string;onConfirm:()=>void})=>void, ReactNode] {
  const [req,setReq]=useState<{title:string;message:string;confirmLabel:string;onConfirm:()=>void}|null>(null);
  const node=req?<Modal title={req.title} onClose={()=>setReq(null)}><p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{req.message}</p><div className="mt-5 flex justify-end gap-2"><button type="button" className={quietBtn} onClick={()=>setReq(null)} data-testid="button-confirm-cancel">Cancel</button><button type="button" className={`${btn} bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))]`} onClick={()=>{const go=req.onConfirm;setReq(null);go();}} data-testid="button-confirm-accept">{req.confirmLabel}</button></div></Modal>:null;
  return [setReq,node];
}
function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const draft = useFloor((s) => s.draft);
  const clients = useFloor((s) => s.clients);
  const [drawer, setDrawer] = useState(false);
  const [askShell, shellConfirm] = useConfirm();
  useEffect(() => drawer ? registerNativeBackHandler(() => setDrawer(false)) : undefined, [drawer]);
  const [notice, setNotice] = useState("");
  const storeNotice = useFloor((s) => s.notice);
  const setStoreNotice = useFloor((s) => s.setNotice);
  useEffect(() => {
    if (!storeNotice) return;
    setNotice(storeNotice);
    setStoreNotice(null);
  }, [storeNotice, setStoreNotice]);
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);
  const items = [
    { href: "/", label: "Today", icon: Activity },
    { href: "/settings", label: "Settings", icon: Settings },
  ];
  const currentPath = location.split("?")[0];
  const nav = <><Link href="/" onClick={() => setDrawer(false)} aria-current={currentPath === "/" ? "page" : undefined} data-testid="link-dashboard" className={`flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${currentPath === "/" ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]" : "text-[hsl(var(--sidebar-foreground))]/75 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"}`}><Activity size={17}/> Today</Link>
    <div className="mb-2 mt-7 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Workspace</div>
    {items.slice(1).map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setDrawer(false)} aria-current={currentPath === href ? "page" : undefined} data-testid="link-settings" className={`mb-1 flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${currentPath === href ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-primary))]" : "text-[hsl(var(--sidebar-foreground))]/75 hover:bg-[hsl(var(--sidebar-accent))] hover:text-[hsl(var(--sidebar-foreground))]"}`}><Icon size={17}/> {label}</Link>)}
    <div className="mb-2 mt-7 flex items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]"><span>Athletes</span><span className="mono">{clients.length}</span></div>
    <div className="max-h-[35vh] space-y-1 overflow-y-auto">{clients.slice(0, 8).map((c) => <Link key={c.id} href={`/clients/${c.id}`} onClick={() => setDrawer(false)} aria-current={currentPath === `/clients/${c.id}` ? "page" : undefined} data-testid={`link-athlete-${c.id}`} className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3 py-2 text-sm ${currentPath === `/clients/${c.id}` ? "bg-[hsl(var(--sidebar-accent))] text-[hsl(var(--sidebar-foreground))]" : "text-[hsl(var(--sidebar-foreground))]/70 hover:bg-[hsl(var(--sidebar-accent))]"}`}><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[hsl(var(--sidebar-foreground))]/10 text-[10px] font-bold">{c.name.split(" ").map(p => p[0]).slice(0,2).join("")}</span><span className="truncate">{c.name}</span></Link>)}</div>
    <div className="mt-auto pt-8"><div className="rounded-2xl border border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar-accent))]/60 p-4"><div className="flex items-center gap-2 text-[hsl(var(--sidebar-primary))]"><ShieldCheck size={15}/><span className="text-xs font-semibold">Your data stays yours</span></div><p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Stored only {isAndroidApp()?"in this app on this device":"in this browser"}. Export a backup before switching devices.</p></div><p className="mono mt-5 text-[9px] leading-relaxed text-[hsl(var(--muted-foreground))]">CoachAura · Training engine derived from GymMane · GPL-3.0</p></div></>;
  return <div className="grain min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"><aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-[hsl(var(--sidebar))] px-4 py-5 text-[hsl(var(--sidebar-foreground))] lg:flex"><BrandLockup className="mb-6 w-full rounded-xl py-1 hover:bg-[hsl(var(--sidebar-accent))]"/>{nav}</aside>
    {drawer && <div data-testid="mobile-navigation-overlay" className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setDrawer(false)}><aside onClick={e => e.stopPropagation()} className="flex h-full w-[min(84vw,300px)] flex-col bg-[hsl(var(--sidebar))] p-4 text-[hsl(var(--sidebar-foreground))]"><div className="mb-7 flex items-center justify-between gap-3"><BrandLockup compact testId="link-brand-drawer" className="min-w-0 flex-1 rounded-xl py-1 hover:bg-[hsl(var(--sidebar-accent))]"/><button onClick={() => setDrawer(false)} aria-label="Close menu" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-[hsl(var(--sidebar-accent))]"><X/></button></div>{nav}</aside></div>}
      <div className="lg:pl-[248px]"><header className="sticky top-0 z-20 flex h-[62px] items-center justify-between border-b border-[hsl(var(--border))] bg-[hsl(var(--background))]/95 px-4 backdrop-blur-md sm:px-7"><div className="flex items-center gap-3"><button className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-[hsl(var(--muted))] lg:hidden" aria-label="Open navigation" onClick={() => setDrawer(true)} data-testid="button-open-nav"><Menu size={19}/></button><BrandLockup compact testId="link-brand-mobile" className="ml-1 rounded-lg px-1 py-0.5 lg:hidden"/><span className="hidden sm:inline text-sm text-[hsl(var(--muted-foreground))]">Personal training, kept in motion.</span></div><div className="flex items-center gap-2">{draft && <Link href={`/clients/${draft.clientId}`} onClick={()=>window.dispatchEvent(new Event("setstack:resume-workout"))} className="inline-flex items-center gap-2 rounded-xl bg-[hsl(var(--secondary))] px-3 py-2 text-xs font-bold text-[hsl(var(--secondary-foreground))]" data-testid="link-active-session"><span className="h-2 w-2 animate-pulse rounded-full bg-[hsl(var(--primary))]"/><span className="hidden sm:inline">Session in progress</span><span className="sm:hidden">Logging</span><ArrowRight size={14}/></Link>}<div className="hidden rounded-xl border border-[hsl(var(--border))] px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] md:block"><span className="mono">{new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span></div></div></header><main className="mx-auto max-w-[1440px] px-4 py-6 sm:px-7 sm:py-8"><div key={location.split("?")[0]} className="page-enter">{children}</div></main></div>
    <WorkoutDrawer ask={askShell}/>{shellConfirm}
    {notice && <div role="status" className="pointer-events-none fixed bottom-20 left-1/2 z-[70] -translate-x-1/2 rounded-2xl bg-[hsl(var(--primary))] px-4 py-3 text-sm font-medium text-[hsl(var(--primary-foreground))] shadow-xl sm:bottom-6" data-testid="status-notice">{notice}</div>}
  </div>;
}

function Header({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="mono mb-2 text-[10px] uppercase tracking-[.2em] text-[hsl(var(--muted-foreground))]">{eyebrow}</p><h1 className="display-font text-[clamp(2rem,5vw,3.15rem)] font-semibold leading-[1.05] tracking-[-.055em]">{title}</h1><p className="mt-2 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">{subtitle}</p></div>{action}</div>;
}

function Dashboard() {
  const [modal, setModal] = useState(false);
  const [paywall, setPaywall] = useState(false);
  return <>
    <TrainerDashboard onAddClient={() => setModal(true)}/>
    {modal && <ClientModal onClose={() => setModal(false)} onPaywall={() => setPaywall(true)}/>}
    {paywall && <LifetimePaywall onClose={() => setPaywall(false)}/>}
  </>;
}

function ClientModal({ onClose, onPaywall = () => {}, client }: { onClose:()=>void; onPaywall?:()=>void; client?:Client }) {
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
    if(client) { updateClient(client.id,obj); onClose(); return; }
    if(!addClient(obj)) {
      setError(`The free plan includes up to ${FREE_CLIENT_LIMIT} clients. Unlock lifetime access to add more. Your existing client records are unchanged.`);
      onPaywall();
      return;
    }
    onClose();
  };
  return <Modal title={client?"Edit athlete":"Add an athlete"} onClose={onClose} wide><form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
    <div className="sm:col-span-2"><label className={labelClass} htmlFor="client-name">Athlete name</label><input id="client-name" name="name" autoFocus required defaultValue={client?.name} className={fieldClass} placeholder="First and last name" data-testid="input-client-name"/></div>
    <div><label className={labelClass} htmlFor="sex">Sex for body metrics</label><select id="sex" name="sex" className={fieldClass} defaultValue={client?.sex??"female"}><option value="female">Female</option><option value="male">Male</option></select></div>
    <div><label className={labelClass} htmlFor="age">Age</label><input id="age" name="age" type="number" min="13" max="110" defaultValue={client?.age??30} className={fieldClass}/></div>
    <div><label className={labelClass} htmlFor="height">Height (cm)</label><input id="height" name="height" type="number" min="80" max="250" defaultValue={client?.heightCm??170} className={fieldClass}/></div>
    <div><label className={labelClass} htmlFor="weight">Bodyweight ({unit})</label><input id="weight" name="weight" type="number" step="0.1" defaultValue={client?toDisplay(client.weightKg,unit).toFixed(1):70} className={fieldClass}/></div>
    <div><label className={labelClass} htmlFor="goal">Sessions per week</label><input id="goal" name="goal" type="number" min="1" max="7" defaultValue={client?.weeklyGoal??3} className={fieldClass}/></div>
    <div><label className={labelClass} htmlFor="activity-factor">Activity level</label><select id="activity-factor" name="activity" className={fieldClass} defaultValue={client?.activity??1.55}><option value="1.2">Sedentary</option><option value="1.375">Light</option><option value="1.55">Moderate</option><option value="1.725">Active</option></select></div>
    <details open={Boolean(client && (client.neckCm != null || client.waistCm != null || client.hipCm != null || client.notes))} className="sm:col-span-2 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3" data-testid="details-client-additional">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 text-sm font-semibold">Measurements & coaching notes <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">Optional</span></summary>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div><label className={labelClass} htmlFor="neck">Neck (cm)</label><input id="neck" name="neck" type="number" step="0.1" defaultValue={client?.neckCm??""} className={fieldClass}/></div>
        <div><label className={labelClass} htmlFor="waist">Waist (cm)</label><input id="waist" name="waist" type="number" step="0.1" defaultValue={client?.waistCm??""} className={fieldClass}/></div>
        <div><label className={labelClass} htmlFor="hip">Hip (cm)</label><input id="hip" name="hip" type="number" step="0.1" defaultValue={client?.hipCm??""} className={fieldClass}/></div>
        <div className="sm:col-span-2"><label className={labelClass} htmlFor="notes">Coaching notes</label><textarea id="notes" name="notes" rows={3} defaultValue={client?.notes} className={fieldClass} placeholder="Injuries, goals, cues to remember…"/></div>
      </div>
    </details>
    {error && <p className="text-sm text-[hsl(0_90%_75%)] sm:col-span-2" role="alert">{error}</p>}
    <div className="mt-2 flex justify-end gap-2 sm:col-span-2"><button type="button" className={quietBtn} onClick={onClose}>Cancel</button><button className={primaryBtn} type="submit" data-testid="button-save-client"><Check size={16}/>{client?"Save changes":"Add athlete"}</button></div>
  </form></Modal>;
}

function ClientPage() {
  const { id }=useParams<{id:string}>();
  const [,setLocation]=useLocation();
  const search=useSearch();
  const clients=useFloor(s=>s.clients);
  const client=clients.find(c=>c.id===id);
  const unit=useFloor(s=>s.unit);
  const startSession=useFloor(s=>s.startSession);
  const setPlanDay=useFloor(s=>s.setPlanDay);
  const clearPlan=useFloor(s=>s.clearPlan);
  const addBodyweight=useFloor(s=>s.addBodyweight);
  const deleteRoutine=useFloor(s=>s.deleteRoutine);
  const deleteSession=useFloor(s=>s.deleteSession);
  const deleteClient=useFloor(s=>s.deleteClient);
  const [edit,setEdit]=useState(false);
  const [editSession,setEditSession]=useState<SessionLog|null>(null);
  const [routineModal,setRoutineModal]=useState<Routine|null|false>(false);
  const [weight,setWeight]=useState("");
  const [ask,confirmNode]=useConfirm();
  const requestedTab = new URLSearchParams(search).get("tab");
  const tab: "overview"|"history"|"records"|"muscles" = requestedTab === "history" || requestedTab === "records" || requestedTab === "muscles" ? requestedTab : "overview";
  const navigateTab = (next: typeof tab) => setLocation(next === "overview" ? `/clients/${id}` : `/clients/${id}?tab=${next}`);
  useEffect(() => {
    setEdit(false);
    setEditSession(null);
    setRoutineModal(false);
    setWeight("");
  }, [id]);
  if(!client) return <Card className="mx-auto max-w-lg p-8 text-center"><h1 className="display-font text-2xl font-semibold">Athlete not found</h1><p className="my-3 text-sm text-[hsl(var(--muted-foreground))]">This profile may have been removed.</p><Link className={primaryBtn} href="/">Back to floor</Link></Card>;
  const summary=clientSummary(client);
  const prs=personalRecords(client);
  const latest=[...client.sessions].sort((a,b)=>b.date.localeCompare(a.date));
  const pool=exercisePool();
  const recordWeight=()=>{const value=Number(weight); if(value>0){addBodyweight(client.id,fromDisplay(value,unit));setWeight("");}};
  const removeClient=()=>ask({title:"Delete athlete?",message:`Delete ${client.name} and all of their sessions, routines and measurements? This cannot be undone.`,confirmLabel:"Delete athlete",onConfirm:()=>{deleteClient(client.id);setLocation("/");}});
  const statusColor=summary.status==="overdue"?"text-[hsl(0_90%_75%)]":summary.status==="due"?"text-[hsl(38_95%_70%)]":"text-[var(--status-on-floor-foreground)]";
  return <><div className="mb-4"><Link href="/" className="inline-flex items-center gap-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" data-testid="link-back-dashboard"><ArrowLeft size={14}/>All athletes</Link></div>
    <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end"><div className="flex min-w-0 items-center gap-4"><Avatar name={client.name} size="lg"/><div className="min-w-0 flex-1"><div className="mb-1 flex flex-wrap items-center gap-2"><p className="mono text-[10px] uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Athlete file · Since {shortDate(client.since)}</p>{client.id.startsWith("seed-")&&<span className="rounded-full bg-[hsl(38_90%_55%/.16)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[hsl(38_95%_70%)]">Demo profile</span>}</div><h1 className="display-font break-words text-[clamp(2rem,5vw,3rem)] font-semibold leading-none tracking-[-.05em]">{client.name}</h1><div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]"><span>{client.age} years</span><span>·</span><span>{client.heightCm} cm</span><span>·</span><span>{formatLoad(client.weightKg,unit)}</span><span>·</span><span className={statusColor}>{summary.status==="overdue"?"Check-in overdue":summary.status==="due"?"Check-in due":"Active athlete"}</span></div></div></div><div className="flex flex-wrap gap-2"><button className={quietBtn} onClick={()=>setEdit(true)} data-testid="button-edit-client"><UserRound size={15}/>Edit profile</button><button className={`${quietBtn} text-[hsl(var(--destructive))]`} onClick={removeClient} data-testid="button-delete-client"><Trash2 size={15}/><span className="hidden sm:inline">Delete</span></button><button className={primaryBtn} onClick={()=>startSession(client.id,client.weeklyPlan[String(isoWeekday(todayIso()))]??client.routines[0]?.id??null)} data-testid="button-client-start-session"><Zap size={16}/>Start session</button></div></div>
     <div role="group" aria-label={`${client.name} profile sections`} className="mb-5 grid min-w-0 grid-cols-2 gap-1 border-b border-[hsl(var(--border))] sm:flex sm:overflow-x-auto">{(["overview","history","records","muscles"] as const).map(key=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>navigateTab(key)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold capitalize ${tab===key?"border-[hsl(var(--primary))] text-[hsl(var(--primary))]":"border-transparent text-[hsl(var(--muted-foreground))]"}`} data-testid={`tab-${key}`}>{key==="records"?"Personal records":key==="history"?"Workout history":key==="muscles"?"Muscle Analytics":"Overview"}</button>)}</div>
      {tab==="overview"&&<div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(330px,.75fr)]"><div className="space-y-5">
       <div className="grid grid-cols-3 gap-2"><Card className="p-3 sm:p-4"><div className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]"><Activity size={14}/><span className="mono text-[9px] uppercase tracking-wider">This week</span></div><p className="display-font mt-2 text-2xl font-semibold">{summary.weekDone}<span className="ml-1 text-xs text-[hsl(var(--muted-foreground))]">/ {summary.weekGoal}</span></p><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">Sessions</p></Card><Card className="p-3 sm:p-4"><div className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]"><Dumbbell size={14}/><span className="mono text-[9px] uppercase tracking-wider">All time</span></div><p className="display-font mt-2 text-2xl font-semibold">{client.sessions.length}</p><p className="mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{summary.streak} day streak</p></Card><Card className="p-3 sm:p-4"><div className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]"><BarChart3 size={14}/><span className="mono text-[9px] uppercase tracking-wider">Top e1RM</span></div><p className="display-font mt-2 truncate text-lg font-semibold">{summary.top?formatLoad(summary.top.e1rm,unit):"—"}</p><p className="mt-1 truncate text-[10px] text-[hsl(var(--muted-foreground))]">{summary.top?.name??"Log a session"}</p></Card></div>
      <Card className="p-5"><div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><SectionTitle kicker="Training structure" title="Weekly plan"/><div className="flex items-center gap-2"><TemplateAssign clientId={client.id} ask={ask}/></div></div>
        {client.routines.length===0&&<div className="mb-4 rounded-xl border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4 text-sm text-[hsl(var(--muted-foreground))]">No plan yet. Assign a template or build an individual routine.</div>}
        <div className="grid gap-2 sm:grid-cols-2">{WEEKDAYS.map((day,index)=>{const rid=client.weeklyPlan[String(index+1)];const routine=client.routines.find(r=>r.id===rid);return <div key={day} className="flex items-center gap-2 rounded-xl bg-[hsl(var(--background))] p-2.5"><span className="w-8 text-[11px] font-bold text-[hsl(var(--muted-foreground))]">{day}</span><select aria-label={`${day} training plan`} className="min-w-0 flex-1 bg-transparent text-xs font-medium outline-none" value={rid??""} onChange={e=>setPlanDay(client.id,index+1,e.target.value||null)} data-testid={`select-plan-${index+1}`}><option value="">Rest day</option>{client.routines.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}</select>{routine&&<button aria-label={`Start ${routine.name}`} className="rounded-lg p-1.5 text-[hsl(var(--chart-1))] hover:bg-[hsl(var(--accent))]" onClick={()=>startSession(client.id,routine.id)} data-testid={`button-plan-start-${index+1}`}><Zap size={15}/></button>}</div>})}</div>
        <div className="mt-4 flex flex-wrap justify-between gap-2 border-t border-[hsl(var(--border))] pt-4"><button className="text-xs font-medium text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" onClick={()=>clearPlan(client.id)} data-testid="button-clear-plan">Clear weekly plan</button><button className={`${quietBtn} min-h-9 px-3`} onClick={()=>setRoutineModal(null)} data-testid="button-new-routine"><Plus size={14}/>New routine</button></div>
      </Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><SectionTitle kicker="Individual sessions" title="Routines"/><ClipboardList size={18} className="text-[hsl(var(--chart-1))]"/></div>{client.routines.length?<div className="space-y-2">{client.routines.map(r=><div key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border))] p-3" data-testid={`routine-${r.id}`}><div className="min-w-0"><h3 className="truncate text-sm font-semibold">{r.name}</h3><p className="mt-1 truncate text-xs text-[hsl(var(--muted-foreground))]">{r.group||"Custom"} · {r.exerciseIds.length} exercises · {Object.values(r.sets).reduce((a,b)=>a+b,0)} sets</p></div><div className="flex shrink-0 gap-1"><button onClick={()=>startSession(client.id,r.id)} aria-label={`Start ${r.name}`} className="rounded-lg bg-[hsl(var(--accent))] p-2 text-[hsl(var(--primary))]" data-testid={`button-start-routine-${r.id}`}><Zap size={15}/></button><button onClick={()=>setRoutineModal(r)} aria-label={`Edit ${r.name}`} className="rounded-lg p-2 hover:bg-[hsl(var(--muted))]" data-testid={`button-edit-routine-${r.id}`}><MoreHorizontal size={16}/></button></div></div>)}</div>:<p className="text-sm text-[hsl(var(--muted-foreground))]">Routines assigned to this athlete will appear here.</p>}</Card>
      <Card className="p-5"><div className="mb-4 flex items-center justify-between"><SectionTitle kicker="Body metrics" title="Bodyweight"/><Weight size={18} className="text-[hsl(var(--chart-1))]"/></div><div className="mb-4 flex items-end gap-2"><div className="flex-1"><label className={labelClass} htmlFor="record-weight">Record new measurement ({unit})</label><input id="record-weight" type="number" step=".1" value={weight} onChange={e=>setWeight(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){e.preventDefault();recordWeight()}}} className={fieldClass} placeholder={toDisplay(client.weightKg,unit).toFixed(1)} data-testid="input-bodyweight"/></div><button className={primaryBtn} onClick={recordWeight} disabled={!weight||Number(weight)<=0} data-testid="button-add-bodyweight"><Plus size={15}/><span className="hidden sm:inline">Record</span></button></div>{client.bodyweight.length?<div className="space-y-2">{client.bodyweight.slice(-5).reverse().map((m,i)=><div key={`${m.date}-${i}`} className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-2 text-sm"><span className="text-[hsl(var(--muted-foreground))]">{shortDate(m.date)}</span><span className="mono font-medium">{formatLoad(m.kg,unit)}</span></div>)}</div>:<p className="text-xs text-[hsl(var(--muted-foreground))]">Measurements appear as you record them.</p>}</Card>
       <Card className="p-5"><details className="group" data-testid="client-notes-details"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden"><div className="min-w-0"><p className="mono text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Coach's notes</p><h2 className="display-font mt-1 text-xl font-semibold tracking-tight">Remember this</h2><p className="mt-1 line-clamp-2 text-xs text-[hsl(var(--muted-foreground))]">{client.notes ? client.notes.slice(0, 120) + (client.notes.length > 120 ? "…" : "") : "No coaching notes yet. Open to add cues, goals or context."}</p></div><ChevronDown size={16} className="shrink-0 text-[hsl(var(--muted-foreground))] transition-transform group-open:rotate-180"/></summary><div className="mt-4 border-t border-[hsl(var(--border))] pt-3"><p className="whitespace-pre-wrap text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{client.notes||"No coaching notes yet. Edit the profile to add cues, goals or context."}</p><div className="mt-4 flex items-center gap-2 border-t border-[hsl(var(--border))] pt-3 text-[10px] text-[hsl(var(--muted-foreground))]"><CircleHelp size={13}/>A note to your future self, before the next session.</div></div></details></Card>
      </div>
      <div className="space-y-5"><Card className="p-5"><SectionTitle kicker="Recent work" title="Latest sessions" action={<button className="text-xs font-semibold text-[hsl(var(--chart-1))]" onClick={()=>navigateTab("history")} data-testid="button-see-history">All history <ArrowRight className="ml-1 inline" size={13}/></button>}/>{latest.length?<div className="space-y-3">{latest.slice(0,4).map(s=><div key={s.id} className="border-b border-[hsl(var(--border))] pb-3 last:border-0 last:pb-0"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold">{s.name}</p><p className="mono mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{shortDate(s.date)} · {s.exercises.length} lifts</p></div><p className="mono text-xs text-[hsl(var(--muted-foreground))]">{Math.round(s.durationSec/60)} min</p></div></div>)}</div>:<p className="text-sm text-[hsl(var(--muted-foreground))]">No sessions recorded yet.</p>}</Card>
        <Card className="border-0 bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]"><p className="mono text-[10px] uppercase tracking-[.16em] opacity-60">Coach's focus</p><p className="display-font mt-2 text-xl font-semibold">{summary.status==="overdue"?"Reconnect with "+client.name.split(" ")[0]:summary.top?`${summary.top.name} is the current high mark.`:"Set the first marker."}</p><p className="mt-2 text-xs leading-relaxed opacity-70">{summary.status==="overdue"?"A short check-in can bring the plan back into focus.":summary.top?`Estimated 1RM ${formatLoad(summary.top.e1rm,unit)}. Small progress adds up.`:"Start a session and CoachAura will keep track of the work."}</p></Card>
      </div>
    </div>}
    {tab==="history"&&<div className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]"><Card className="p-5"><SectionTitle kicker="Training log" title="Workout history"/>{latest.length?<div className="space-y-3">{latest.map(session=><details key={session.id} className="group rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]"><summary className="flex cursor-pointer list-none items-center gap-3 p-4"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"><Dumbbell size={17}/></div><div className="min-w-0 flex-1"><p className="font-semibold">{session.name}</p><p className="mono mt-1 text-[10px] text-[hsl(var(--muted-foreground))]">{shortDate(session.date)} · {Math.round(session.durationSec/60)} min · {session.exercises.length} exercises</p></div><ChevronDown size={16} className="transition group-open:rotate-180"/></summary><div className="space-y-3 border-t border-[hsl(var(--border))] px-4 py-3">{session.exercises.map(ex=><div key={ex.id}><div className="flex justify-between text-sm font-semibold"><span>{ex.name}</span><span className="mono text-xs">{formatLoad(bestSetOneRm(ex.sets),unit)} e1RM</span></div><div className="mt-1 flex flex-wrap gap-1.5">{ex.sets.map((set,i)=><span key={set.id} className="rounded-md bg-[hsl(var(--muted))] px-2 py-1 mono text-[10px]">{i+1} · {formatLoad(set.weight,unit)} × {set.reps}{set.rpe!=null?` · RIR ${(10-set.rpe).toFixed(set.rpe%1?1:0)}`:""}{set.kind!=="normal"?` · ${set.kind}`:""}</span>)}</div></div>)}<div className="mt-1 flex gap-4"><button className="text-xs font-semibold text-[hsl(var(--primary))]" onClick={()=>setEditSession(session)} data-testid={`button-edit-session-${session.id}`}>Edit this session</button><button className="text-xs font-medium text-[hsl(var(--destructive))]" onClick={()=>ask({title:"Delete session?",message:"Delete this workout from the training history?",confirmLabel:"Delete session",onConfirm:()=>deleteSession(client.id,session.id)})} data-testid={`button-delete-session-${session.id}`}>Delete this session</button></div></div></details>)}</div>:<div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">Completed sessions will appear here. Start a workout to add the first one.</div>}</Card>
      <Card className="p-5"><SectionTitle kicker="Body metrics" title="Measurement timeline"/>{client.bodyweight.length?<div className="space-y-3">{[...client.bodyweight].reverse().map((m,index)=><div key={`${m.date}-${index}`} className="flex items-center gap-3"><div className="mono w-14 text-xs text-[hsl(var(--muted-foreground))]">{shortDate(m.date)}</div><div className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--chart-1))]" style={{width:`${Math.max(10,Math.min(100,(m.kg/120)*100))}%`}}/></div><span className="mono w-16 text-right text-xs">{formatLoad(m.kg,unit)}</span></div>)}</div>:<p className="text-sm text-[hsl(var(--muted-foreground))]">Add measurements to build a timeline.</p>}</Card></div>}
    {tab==="records"&&<Card className="p-5"><SectionTitle kicker="All-time best estimated one-rep max" title="Personal records"/>{prs.length?<div className="grid gap-3 md:grid-cols-2">{prs.map((pr,index)=><div key={pr.id} className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4" data-testid={`record-${pr.id}`}><div className="absolute right-4 top-4 mono text-[10px] text-[hsl(var(--muted-foreground))]">#{String(index+1).padStart(2,"0")}</div><p className="max-w-[75%] text-sm font-semibold">{pr.name}</p><div className="display-font mt-3 text-3xl font-semibold">{formatLoad(pr.e1rm,unit)}</div><p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatLoad(pr.weight,unit)} × {pr.reps} reps · {pr.date} · {pr.method.toUpperCase()} estimate</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]"><div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{width:`${Math.min(100,pr.e1rm/(prs[0]?.e1rm??1)*100)}%`}}/></div></div>)}</div>:<div className="rounded-xl border border-dashed border-[hsl(var(--border))] p-8 text-center text-sm text-[hsl(var(--muted-foreground))]">PRs are estimated from logged work sets. Warm-up sets don't count.</div>}</Card>}
    {tab==="muscles"&&<Suspense fallback={<Card className="p-5"><p role="status" className="text-sm text-[hsl(var(--muted-foreground))]">Loading muscle analytics…</p></Card>}><div className="space-y-5"><ClientOverviewVisualizations client={client} exerciseLibrary={pool} unit={unit}/><MuscleActivityDashboard client={client}/></div></Suspense>}
    {editSession&&<Suspense fallback={<Modal title="Opening workout editor…" onClose={()=>setEditSession(null)}><p role="status">Loading editor…</p></Modal>}><SessionEditor client={client} session={editSession} onClose={()=>setEditSession(null)}/></Suspense>}
    {edit&&<ClientModal client={client} onClose={()=>setEdit(false)}/>}
    {routineModal!==false&&<Suspense fallback={<Modal title="Opening routine editor…" onClose={()=>setRoutineModal(false)}><p role="status">Loading editor…</p></Modal>}><RoutineModal client={client} routine={routineModal||undefined} pool={pool} onClose={()=>setRoutineModal(false)} onDelete={routineModal?()=>ask({title:"Delete routine?",message:`Delete routine "${routineModal.name}"? Weekly plan assignments will also be cleared.`,confirmLabel:"Delete routine",onConfirm:()=>{deleteRoutine(client.id,routineModal.id);setRoutineModal(false)}}):undefined}/></Suspense>}
    {confirmNode}
  </>;
}

function SettingsPage() {
  const [ask,confirmNode]=useConfirm();
  const unit=useFloor(s=>s.unit);
  const setUnit=useFloor(s=>s.setUnit);
  const appearance=useFloor(s=>s.appearance);
  const setAppearance=useFloor(s=>s.setAppearance);
  const resetDemo=useFloor(s=>s.resetDemo);
  const backupReminder=useBackupReminder();
  const [status,setStatus]=useState("");
  const native=isAndroidApp();
  const [restoreText,setRestoreText]=useState("");
  const [confirmRestore,setConfirmRestore]=useState(false);
  const [paywall,setPaywall]=useState(false);
  const billing=useBillingSnapshot();
  const fileRef=useRef<HTMLInputElement>(null);
  const clients=useFloor(s=>s.clients);
  const readFile=(file?:File)=>{if(!file)return;if(file.size>MAX_BACKUP_BYTES){setStatus("Backup exceeds the 20 MB safety limit.");return;}const reader=new FileReader();reader.onload=()=>{const raw=String(reader.result??"");const result=useFloor.getState().previewBackup(raw);if(!result.ok){setStatus(result.error);return;}setRestoreText(raw);setConfirmRestore(true)};reader.onerror=()=>setStatus("Could not read that file. Try another JSON backup.");reader.readAsText(file);};
  const reset=()=>ask({title:"Reset demo data?",message:"Reset all local data to the original demo floor? This replaces your current athletes and sessions.",confirmLabel:"Reset data",onConfirm:()=>{resetDemo();setStatus("Demo data restored.");}});
  return <>{confirmNode}<Header eyebrow="Workspace preferences" title="Keep your data close." subtitle="Set your working units and make a portable copy of the training floor."/>
     <div className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
       <div className="space-y-5">
         <Card className="p-5 sm:p-6">
           <SectionTitle kicker="Display preferences" title="Appearance"/>
               <p id="appearance-theme-help" className="mb-4 max-w-lg text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Choose Original Lime Green or Peach Theme. Original Lime Green is the default. Your choice is saved on this device.</p>
             <p id="appearance-theme-label" className={`${labelClass} mb-2`}>Theme</p>
            <div id="appearance-theme" role="group" aria-labelledby="appearance-theme-label" aria-describedby="appearance-theme-help" className="grid gap-2 sm:grid-cols-2" data-testid="select-appearance">
              {APPEARANCE_THEMES.map((theme)=>(
                <button
                  key={theme.value}
                  type="button"
                  aria-pressed={appearance===theme.value}
                  aria-label={`${theme.label}, ${theme.mode} theme`}
                  onClick={()=>setAppearance(theme.value)}
                  className={`flex min-h-16 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${appearance===theme.value?"border-[hsl(var(--primary))] bg-[hsl(var(--accent))]":"border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]"}`}
                  data-testid={`button-appearance-${theme.value}`}
                >
                  <span aria-hidden="true" className="flex shrink-0 gap-1">
                    {theme.swatches.map((color,index)=><span key={index} className="h-5 w-5 rounded-full border border-black/10" style={{backgroundColor:color}}/>)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold leading-tight">{theme.label}</span>
                    <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">{theme.mode} palette</span>
                  </span>
                  {appearance===theme.value&&<Check aria-hidden="true" className="shrink-0 text-[hsl(var(--primary))]" size={17}/>}
                </button>
              ))}
            </div>
         </Card>
         <Card className="p-5 sm:p-6"><SectionTitle kicker="Display preferences" title="Training units"/><p className="mb-4 max-w-lg text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Choose how loads appear in the workspace. Stored values stay in kilograms so your training history remains consistent.</p><div className="flex max-w-sm gap-2 rounded-xl bg-[hsl(var(--muted))] p-1"><button onClick={()=>setUnit("kg")} className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${unit==="kg"?"bg-[hsl(var(--card))] shadow-sm":""}`} data-testid="button-unit-kg">Kilograms · kg</button><button onClick={()=>setUnit("lb")} className={`flex-1 rounded-lg py-2.5 text-sm font-bold ${unit==="lb"?"bg-[hsl(var(--card))] shadow-sm":""}`} data-testid="button-unit-lb">Pounds · lb</button></div></Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle kicker="Portable data" title="Backup & restore"/>
          <p className="mb-4 max-w-xl text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Your workspace is saved only in {native?"this app's":"this browser's"} local storage. Backups are saved to a location you choose; CoachAura does not upload them. {native&&"Browser and APK storage are separate, so import a browser backup to transfer clients."}</p>
          <div className="mb-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3"><p className="mono mb-1 text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Backup status</p><BackupStatusText timestamp={backupReminder.state.lastSuccessfulExportAt}/></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(var(--accent))] text-[hsl(var(--primary))]"><ShieldCheck size={19}/></div>
              <h3 className="mt-3 font-semibold">Export a backup</h3>
              <p className="mt-1 min-h-[36px] text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Includes clients, measurements, notes, completed sessions, custom exercises, templates, current preferences and an unfinished workout.</p>
              <BackupExportAction buttonLabel="Export Backup" buttonClassName={`${quietBtn} w-full`} testId="button-export-backup" onConfirmSaved={backupReminder.recordSuccessfulExport}/>
            </div>
            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[hsl(38_90%_55%/.16)] text-[hsl(38_95%_70%)]"><FileUp size={19}/></div>
              <h3 className="mt-3 font-semibold">Restore a backup</h3>
              <p className="mt-1 min-h-[36px] text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Choose a CoachAura JSON file. CoachAura validates and previews it first; confirming replaces the current workspace after a recovery copy is kept on this device.</p>
              <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={e=>readFile(e.target.files?.[0])} data-testid="input-backup-file"/>
              <button className={`${quietBtn} mt-4 w-full`} onClick={()=>fileRef.current?.click()} data-testid="button-import-backup"><FileUp size={15}/>Choose JSON</button>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[hsl(38_90%_55%/.35)] bg-[hsl(38_90%_55%/.1)] p-3 text-xs leading-relaxed text-[hsl(38_95%_80%)]"><CircleHelp className="mt-0.5 shrink-0" size={15}/><span>Backups include personal coaching notes and measurements. The JSON file is not encrypted by CoachAura; save it somewhere private. The reminder is updated only after you confirm that a permanent copy was saved.</span></div>
          {status&&<p role="status" className="mt-4 rounded-xl bg-[hsl(var(--accent))] px-3 py-2 text-sm" data-testid="status-settings">{status}</p>}
        </Card></div>
      <div className="space-y-5">
        <Card className="p-5" data-testid="card-lifetime-entitlement">
          <SectionTitle kicker="CoachAura plan" title={billing.status==="lifetime"?"Lifetime access":"Free plan"}/>
          <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
            {billing.status==="lifetime"
              ? "Unlimited client profiles are enabled on this device."
              : `Create up to ${FREE_CLIENT_LIMIT} client profiles for free. A one-time Google Play purchase unlocks unlimited clients; there are no subscriptions.`}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" className={primaryBtn} onClick={()=>setPaywall(true)} data-testid="button-open-lifetime-paywall">
              {billing.status==="lifetime"?"Purchase details":"Unlock lifetime"}
            </button>
            <button type="button" className={quietBtn} onClick={()=>void billingController.refresh()} data-testid="button-settings-restore">
              Recheck / restore
            </button>
          </div>
          {billing.message&&<p role="status" className="mt-3 rounded-xl bg-[hsl(var(--muted))] px-3 py-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]" data-testid="status-entitlement">{billing.message}</p>}
          {billing.price&&<p className="mt-3 text-xs text-[hsl(var(--muted-foreground))]">Current Google Play price: <span className="font-semibold text-[hsl(var(--foreground))]">{billing.price}</span> · one-time</p>}
        </Card>
        <Card className="overflow-hidden"><div className="bg-[hsl(var(--primary))] p-5 text-[hsl(var(--primary-foreground))]"><div className="flex items-start justify-between"><div><p className="mono text-[10px] uppercase tracking-widest opacity-60">Local-first by design</p><h2 className="display-font mt-3 text-2xl font-semibold">One browser.<br/>Your whole floor.</h2></div><ShieldCheck size={22} className="text-[hsl(var(--secondary))]"/></div><p className="mt-3 max-w-sm text-sm leading-relaxed opacity-75">CoachAura works without an internet service. It does not use an account or sync data to the cloud.</p></div><div className="space-y-3 p-5"><div className="flex items-center gap-3 text-sm"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]"><Users size={15}/></span><span className="flex-1">Athletes on this browser</span><span className="mono font-semibold">{clients.length}</span></div><div className="flex items-center gap-3 text-sm"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--muted))]"><ClipboardList size={15}/></span><span className="flex-1">Training sessions saved</span><span className="mono font-semibold">{clients.reduce((n,c)=>n+c.sessions.length,0)}</span></div></div></Card>
        <Card className="border-[hsl(var(--destructive))]/25 p-5"><p className="mono text-[10px] uppercase tracking-widest text-[hsl(var(--destructive))]">Demo data</p><h3 className="display-font mt-2 text-lg font-semibold">Reset the demo floor</h3><p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">The starter athletes are clearly marked as demo. Reset brings the original examples back and removes local changes.</p><button onClick={reset} className={`${quietBtn} mt-4 text-[hsl(var(--destructive))]`} data-testid="button-reset-demo"><Activity size={15}/>Reset demo data</button></Card>
        <div className="px-1 text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">Training engine derived from GymMane by InlitX and contributors. Licensed under GNU GPL-3.0. See included LICENSE and third_party/gymmane/NOTICE.</div>
      </div>
    </div>
    <button className={`${quietBtn} mt-4`} onClick={()=>{void exportOriginalStorage(true).then(setStatus).catch(error=>setStatus(error instanceof Error?error.message:"Could not export recovery copy."));}} data-testid="button-export-before-restore">Download pre-restore copy</button>
    {confirmRestore&&<BackupRestoreDialog raw={restoreText} onClose={()=>{setConfirmRestore(false);setRestoreText("")}} onRestored={()=>{setStatus("Backup restored and saved on this device. A pre-restore recovery copy is available.");setConfirmRestore(false);setRestoreText("")}}/>}
    {paywall&&<LifetimePaywall onClose={()=>setPaywall(false)}/>}
  </>;
}

function NotFoundPage() {
  return <Card className="mx-auto max-w-lg p-8 text-center"><div className="mono text-xs text-[hsl(var(--muted-foreground))]">404 · Off the floor</div><h1 className="display-font mt-3 text-3xl font-semibold">This page isn't in the plan.</h1><Link href="/" className={`${primaryBtn} mt-5`} data-testid="link-not-found-home">Back to today</Link></Card>;
}

function WorkspaceApp() {
  const health=usePersistenceHealth();
  const appearance=useFloor(s=>s.appearance);
  useLayoutEffect(()=>{
    if(health.phase==="loading"||health.phase==="read-error")return;
    const root=document.documentElement;
    if(appearance==="default")delete root.dataset.appearance;
    else root.dataset.appearance=appearance;
    root.classList.add("dark");
    const themeColor=appearance==="orange-charcoal"?"#111214":"#0B0B0D";
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content",themeColor);
  },[appearance,health.phase]);
  useEffect(()=>{void initializePlayBilling();},[]);
  useEffect(()=>{void Promise.resolve(useFloor.persist.rehydrate()).catch(()=>{});},[]);
  if(health.phase==="read-error")return <PersistenceStatus/>;
  if(health.phase==="loading") return <div className="flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] p-6"><div className="w-full max-w-sm"><div className="mb-5 h-8 w-36 animate-pulse rounded-lg bg-[hsl(var(--muted))]"/><div className="h-36 animate-pulse rounded-2xl bg-[hsl(var(--muted))]"/><div className="mt-4 h-20 animate-pulse rounded-2xl bg-[hsl(var(--muted))]"/></div></div>;
  return <><AppShell><Switch><Route path="/" component={Dashboard}/><Route path="/clients/:id" component={ClientPage}/><Route path="/settings" component={SettingsPage}/><Route component={NotFoundPage}/></Switch></AppShell><PersistenceStatus/></>;
}

function App() {
  return <Switch><Route path="/privacy-policy" component={PrivacyPolicyPage}/><Route component={WorkspaceApp}/></Switch>;
}

export default App;
