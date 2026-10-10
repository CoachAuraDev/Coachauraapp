import type { Client, SessionLog } from "./models.ts";
import { shiftIso, weekStart, todayIso } from "./engine.ts";
import { sessionVolume, workingSets } from "./metrics.ts";

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const validDate = (d: unknown): d is string => {
  if (typeof d !== "string" || !ISO.test(d)) return false;
  const value = new Date(`${d}T12:00:00Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === d;
};

function sessionsOf(c: Client): SessionLog[] {
  return (Array.isArray(c.sessions) ? c.sessions : []).filter((s) => s && validDate(s.date));
}
// Sanitize malformed imports for display only, without changing saved records or workout maths.
const exs = (s: SessionLog) => (Array.isArray(s.exercises) ? s.exercises : [])
  .filter((e) => e && Array.isArray(e.sets))
  .map((e) => ({ ...e, sets: e.sets.filter((set) => set && Number.isFinite(set.reps) && Number.isFinite(set.weight) && set.reps >= 0 && set.weight >= 0) }));

export function weekOverview(clients: Client[], today: string) {
  const start = weekStart(today);
  const end = shiftIso(start, 6);
  let workouts = 0, sets = 0, volume = 0, goal = 0, done = 0;
  const active = new Set<string>();
  const days = Array.from({ length: 7 }, (_, i) => ({ date: shiftIso(start, i), count: 0, planned: 0 }));
  for (const c of clients) {
    const target = Number.isFinite(c.weeklyGoal) ? Math.max(0, c.weeklyGoal) : 0;
    goal += target;
    const ds = new Set<string>();
    for (const s of sessionsOf(c)) {
      if (s.date < start || s.date > end || s.date > today) continue;
      workouts++; active.add(c.id); ds.add(s.date);
      days[days.findIndex((d) => d.date === s.date)]!.count++;
      volume += sessionVolume({ ...s, exercises: exs(s) });
      for (const e of exs(s)) sets += workingSets(Array.isArray(e.sets) ? e.sets : []).length;
    }
    done += Math.min(ds.size, target);
    for (const [k, routineId] of Object.entries(c.weeklyPlan ?? {})) {
      const n = Number(k);
      if (Number.isInteger(n) && n >= 1 && n <= 7 && c.routines?.some((r) => r.id === routineId))
        days[n - 1]!.planned++;
    }
  }
  return { workouts, sets, volume, activeClients: active.size, goal, done, days };
}

export type Activity =
  | { kind: "workout"; date: string; client: Client; session: SessionLog }
  | { kind: "bodyweight"; date: string; client: Client; kg: number };

export function recentActivity(clients: Client[], limit = 8, today = todayIso()): Activity[] {
  const out: Activity[] = [];
  for (const client of clients) {
    for (const session of sessionsOf(client)) if (session.date <= today) out.push({ kind: "workout", date: session.date, client, session });
    for (const b of Array.isArray(client.bodyweight) ? client.bodyweight : [])
      if (b && validDate(b.date) && b.date <= today && Number.isFinite(b.kg) && b.kg > 0) out.push({ kind: "bodyweight", date: b.date, client, kg: b.kg });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}
