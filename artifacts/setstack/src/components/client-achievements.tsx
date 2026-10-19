import { useEffect, useMemo, useRef, useState } from "react";
import { Award, Check, LockKeyhole, Sparkles } from "lucide-react";
import { Modal } from "@/components/workout/shared";
import { useFloor } from "@/lib/gymmane/store";
import { shortDate } from "@/lib/gymmane/engine";
import type { Client } from "@/lib/gymmane/models";
import {
  ACHIEVEMENT_CATEGORIES,
  ACHIEVEMENT_DEFINITIONS,
  ACHIEVEMENT_LEDGER_EVENT,
  calculateAchievements,
  markAchievementsCelebrated,
  readAchievementLedger,
  type AchievementAward,
  type AchievementCategory,
  type AchievementLedger,
  type ReadLedgerResult,
} from "@/lib/gymmane/achievements";

function safeAchievementStorage(): Storage | null {
  try { return typeof window === "undefined" ? null : window.localStorage; }
  catch { return null; }
}

export function ClientAchievements({ client }: { client: Client }) {
  const draft = useFloor((state) => state.draft);
  const [category, setCategory] = useState<AchievementCategory>("workouts");
  const [ledgerState, setLedgerState] = useState<ReadLedgerResult>(() => readAchievementLedger(safeAchievementStorage()));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<AchievementAward[] | null>(null);
  const [celebrationError, setCelebrationError] = useState("");
  const timeout = useRef<number | null>(null);
  const shownThisMount = useRef(new Set<string>());
  const awards = useMemo(() => calculateAchievements(client), [client]);
  const awardsById = useMemo(() => new Map(awards.map((award) => [award.id, award])), [awards]);
  const ledger = ledgerState.ok ? ledgerState.ledger : null;
  const clientLedger = ledger?.clients[client.id];
  const earnedCount = awards.length;
  const selectedAchievement = ACHIEVEMENT_DEFINITIONS.find((item) => item.id === selectedId) ?? null;
  const selectedAward = selectedAchievement ? awardsById.get(selectedAchievement.id) : undefined;
  const savedAward = selectedAchievement ? clientLedger?.awards[selectedAchievement.id] : undefined;
  const awardForDetail = selectedAward ? savedAward ?? selectedAward : undefined;

  useEffect(() => {
    const refresh = () => setLedgerState(readAchievementLedger(safeAchievementStorage()));
    window.addEventListener(ACHIEVEMENT_LEDGER_EVENT, refresh);
    return () => window.removeEventListener(ACHIEVEMENT_LEDGER_EVENT, refresh);
  }, []);

  useEffect(() => {
    if (draft || !ledger || !clientLedger?.pending.length || celebration) return;
    const newlyEarned = clientLedger.pending
      .map((id) => awardsById.get(id))
      .filter((award): award is AchievementAward => !!award && !shownThisMount.current.has(award.id));
    if (!newlyEarned.length) return;

    newlyEarned.forEach((award) => shownThisMount.current.add(award.id));
    setCelebration(newlyEarned);
    const result = markAchievementsCelebrated(safeAchievementStorage(), client.id, newlyEarned.map((award) => award.id));
    if (result.ok) setLedgerState({ ok: true, ledger: result.ledger });
    else setCelebrationError(result.error);
    timeout.current = window.setTimeout(() => {
      setCelebration(null);
      setCelebrationError("");
      timeout.current = null;
    }, 6000);
  }, [awardsById, celebration, client.id, clientLedger, draft, ledger]);

  useEffect(() => () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
  }, []);

  const dismissCelebration = () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    timeout.current = null;
    setCelebration(null);
    setCelebrationError("");
  };

  return (
    <section className="rounded-2xl border border-[hsl(var(--card-border))] bg-[hsl(var(--card))] p-5" data-testid="achievements-section">
      {celebration && <div className="achievement-celebration mb-5 rounded-xl border border-[hsl(var(--primary)/.4)] bg-[hsl(var(--accent))] p-4" role="status" aria-live="polite" data-testid="achievement-celebration">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[hsl(var(--primary)/.45)] bg-[hsl(var(--card))] text-[hsl(var(--primary))]"><Sparkles size={18}/></span>
          <div className="min-w-0 flex-1">
            <p className="mono text-[10px] uppercase tracking-[.16em] text-[hsl(var(--primary))]">Achievement unlocked</p>
            {celebration.map((award) => {
              const definition = ACHIEVEMENT_DEFINITIONS.find((item) => item.id === award.id);
              return definition ? <div key={award.id} className="mt-1">
                <p className="font-semibold">{definition.name}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{award.milestone}</p>
              </div> : null;
            })}
            {celebrationError && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">{celebrationError}</p>}
          </div>
          <button type="button" onClick={dismissCelebration} aria-label="Dismiss achievement message" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))]" data-testid="button-dismiss-achievement-celebration">×</button>
        </div>
      </div>}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono mb-1 text-[10px] uppercase tracking-[.17em] text-[hsl(var(--muted-foreground))]">Client milestones</p>
          <h2 className="display-font text-xl font-semibold tracking-tight">Achievements</h2>
        </div>
        <p className="mono text-sm font-semibold text-[hsl(var(--primary))]" data-testid="achievement-count">{earnedCount} / {ACHIEVEMENT_DEFINITIONS.length} earned</p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]" role="progressbar" aria-label="Achievement progress" aria-valuemin={0} aria-valuemax={ACHIEVEMENT_DEFINITIONS.length} aria-valuenow={earnedCount}>
        <div className="h-full rounded-full bg-[hsl(var(--primary))] transition-[width] duration-300" style={{ width: `${earnedCount / ACHIEVEMENT_DEFINITIONS.length * 100}%` }}/>
      </div>
      {!ledgerState.ok && <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]" role="status" data-testid="achievement-storage-warning">{ledgerState.error}</p>}

      <div className="mt-4 grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="tablist" aria-label="Achievement categories">
        {ACHIEVEMENT_CATEGORIES.map((item) => {
          const count = ACHIEVEMENT_DEFINITIONS.filter((definition) => definition.category === item.id).length;
          const unlocked = awards.filter((award) => ACHIEVEMENT_DEFINITIONS.find((definition) => definition.id === award.id)?.category === item.id).length;
          const selected = category === item.id;
          return <button
            key={item.id}
            id={`achievement-category-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls="achievement-category-panel"
            onClick={() => setCategory(item.id)}
            className={`min-h-10 rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${selected ? "bg-[hsl(var(--accent))] text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]"}`}
            data-testid={`achievement-category-${item.id}`}
          >
            {item.label} <span className="ml-1 mono text-[10px] opacity-75">{unlocked}/{count}</span>
          </button>;
        })}
      </div>

      <div id="achievement-category-panel" className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3" role="tabpanel" aria-labelledby={`achievement-category-${category}`} data-testid="achievement-category-panel">
        {ACHIEVEMENT_DEFINITIONS.filter((item) => item.category === category).map((definition) => {
          const award = awardsById.get(definition.id);
          return <button
            key={definition.id}
            type="button"
            aria-label={`${definition.name}, ${award ? "earned" : "locked"}. Open details.`}
            onClick={() => setSelectedId(definition.id)}
            className={`relative flex min-h-[88px] min-w-0 items-center gap-2 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--ring))] ${award ? "border-[hsl(var(--primary)/.42)] bg-[hsl(var(--accent)/.65)] shadow-[0_0_16px_hsl(var(--primary)/.08)]" : "border-[hsl(var(--border))] bg-[hsl(var(--background))] hover:bg-[hsl(var(--muted))]"}`}
            data-testid={`achievement-badge-${definition.id}`}
          >
            <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${award ? "border-[hsl(var(--primary)/.5)] bg-[hsl(var(--card))] text-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"}`}>
              {award ? <Award size={17}/> : <LockKeyhole size={15}/>}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-xs font-semibold leading-snug ${award ? "text-[hsl(var(--foreground))]" : "text-[hsl(var(--muted-foreground))]"}`}>{definition.name}</span>
              <span className={`mt-1 block text-[10px] font-medium ${award ? "text-[hsl(var(--primary))]" : "text-[hsl(var(--muted-foreground))]"}`}>{award ? "Earned" : "Locked"}</span>
            </span>
            {award && <Check aria-hidden="true" className="absolute right-2 top-2 text-[hsl(var(--primary))]" size={13}/>}
          </button>;
        })}
      </div>

      {selectedAchievement && <Modal title={selectedAchievement.name} onClose={() => setSelectedId(null)}>
        <div className="space-y-4" data-testid={`achievement-detail-${selectedAchievement.id}`}>
          <div className={`flex h-14 w-14 items-center justify-center rounded-full border ${awardForDetail ? "border-[hsl(var(--primary)/.5)] bg-[hsl(var(--accent))] text-[hsl(var(--primary))]" : "border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"}`}>
            {awardForDetail ? <Award size={23}/> : <LockKeyhole size={21}/>}
          </div>
          <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{selectedAchievement.description}</p>
          {awardForDetail ? <>
            <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
              <p className="mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Unlocked</p>
              <p className="mt-1 text-sm font-semibold" data-testid="achievement-unlock-date">{shortDate(awardForDetail.unlockedAt)}</p>
            </div>
            <div className="rounded-xl border border-[hsl(var(--primary)/.24)] bg-[hsl(var(--accent)/.5)] p-3">
              <p className="mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Milestone reached</p>
              <p className="mt-1 text-sm font-medium leading-relaxed" data-testid="achievement-milestone">{awardForDetail.milestone}</p>
            </div>
          </> : <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-3">
            <p className="mono text-[10px] uppercase tracking-wider text-[hsl(var(--muted-foreground))]">How to unlock</p>
            <p className="mt-1 text-sm leading-relaxed">{selectedAchievement.requirement}</p>
          </div>}
        </div>
      </Modal>}
    </section>
  );
}
