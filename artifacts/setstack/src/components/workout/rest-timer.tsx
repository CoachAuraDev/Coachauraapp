import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Settings, SkipForward, Volume2 } from "lucide-react";
import { useFloor } from "@/lib/gymmane/store";
import { fieldClass, quietBtn } from "./shared";

let audioCtx: AudioContext | null = null;
function unlockAudio() {
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx = audioCtx ?? new Ctor();
    if (audioCtx.state === "suspended") void audioCtx.resume();
  } catch { /* sound is optional */ }
}
function beep() {
  if (!audioCtx) return;
  try {
    for (let i = 0; i < 3; i++) {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = audioCtx.currentTime + i * 0.28;
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + 0.22);
    }
  } catch { /* ignore */ }
}
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function RestTimer({ defaultSeconds, compact = false }: { defaultSeconds: number; compact?: boolean }) {
  const draft = useFloor((s) => s.draft);
  const configureRest = useFloor((s) => s.configureRest);
  const startRest = useFloor((s) => s.startRest);
  const pauseRest = useFloor((s) => s.pauseRest);
  const resetRest = useFloor((s) => s.resetRest);
  const skipRest = useFloor((s) => s.skipRest);
  const bumpRest = useFloor((s) => s.bumpRest);
  const [now, setNow] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const duration = draft?.restDurationSeconds ?? defaultSeconds;
  const paused = draft?.restPausedSeconds ?? null;
  const until = draft?.restUntil ?? null;
  const running = paused == null && until != null;
  const [secs, setSecs] = useState(String(duration));
  useEffect(() => setSecs(String(duration)), [duration]);

  useEffect(() => {
    if (!running) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 250);
    const vis = () => tick();
    document.addEventListener("visibilitychange", vis);
    return () => { window.clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [running, until]);

  const remaining = paused != null ? Math.max(0, Math.ceil(paused)) : until != null ? Math.max(0, Math.ceil((until - now) / 1000)) : duration;
  const done = running && remaining <= 0;
  const alerted = useRef<number | null>(null);
  useEffect(() => {
    if (!done || until == null || alerted.current === until) return;
    alerted.current = until;
    if (draft?.timerSound) beep();
    if (draft?.timerVibration && typeof navigator.vibrate === "function") navigator.vibrate([200, 100, 200]);
  }, [done, until, draft?.timerSound, draft?.timerVibration]);

  const soundOn = !!draft?.timerSound;
  useEffect(() => {
    if (!soundOn) return;
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, [soundOn]);

  if (!draft) return null;
  const canVibrate = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
  const apply = (sound = !!draft.timerSound, vib = !!draft.timerVibration) => {
    const n = Math.min(600, Math.max(5, Math.round(Number(secs) || duration)));
    configureRest(n, sound, vib);
  };
  const state = done ? "Rest finished" : paused != null ? "Paused" : running ? "Resting" : "Rest timer";
  return <div className={`${compact ? "mb-3 rounded-xl px-3 py-2" : "mb-4 rounded-2xl p-3"} border ${done ? "border-[hsl(var(--primary))] bg-[hsl(var(--accent))]" : "border-[hsl(var(--border))] bg-[hsl(var(--background))]"}`} data-testid="panel-rest-timer">
    <div className={`${compact ? "flex items-center justify-between gap-2" : "grid gap-3 sm:grid-cols-[100px_minmax(0,1fr)]"}`}>
      <div className="min-w-0"><p className="mono text-[9px] uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]" data-testid="text-rest-state">{state}</p><p className={`display-font whitespace-nowrap font-semibold tabular-nums ${compact ? "text-2xl leading-none" : "text-3xl"}`} role="timer" aria-live="off" data-testid="text-rest-remaining">{fmt(remaining)}</p></div>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
      {running && !done ? <button className={`${quietBtn} px-3`} onClick={pauseRest} data-testid="button-rest-pause"><Pause size={15}/>Pause</button> : <button className={`${quietBtn} px-3`} onClick={startRest} data-testid="button-rest-start"><Play size={15}/>{paused != null ? "Resume" : "Start"}</button>}
      <button className={`${quietBtn} px-3`} onClick={resetRest} aria-label="Reset rest timer" data-testid="button-rest-reset"><RotateCcw size={15}/></button>
      {running && <button className={`${quietBtn} px-3`} onClick={() => bumpRest(15)} data-testid="button-rest-bump">+15s</button>}
      {(running || paused != null) && <button className={`${quietBtn} px-3`} onClick={skipRest} aria-label="Dismiss rest timer" data-testid="button-rest-skip"><SkipForward size={15}/></button>}
      <button className={`${quietBtn} px-3`} onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Timer settings" data-testid="button-rest-settings"><Settings size={15}/></button>
      </div>
    </div>
    {open && <div className="mt-3 grid gap-3 border-t border-[hsl(var(--border))] pt-3 sm:grid-cols-[110px_1fr]">
      <div><label className="mb-1 block text-[11px] font-semibold text-[hsl(var(--muted-foreground))]" htmlFor="rest-seconds">Seconds</label><input id="rest-seconds" className={fieldClass} type="number" min="5" max="600" step="1" inputMode="numeric" value={secs} onChange={(e) => setSecs(e.target.value)} onBlur={() => apply()} data-testid="input-rest-seconds"/></div>
      <div className="space-y-2 text-xs">
        <label className="flex items-center gap-2"><input type="checkbox" checked={!!draft.timerSound} onChange={(e) => { if (e.target.checked) { unlockAudio(); beep(); } apply(e.target.checked); }} data-testid="toggle-rest-sound"/><Volume2 size={14}/>Play a tone when rest ends</label>
        {canVibrate && <label className="flex items-center gap-2"><input type="checkbox" checked={!!draft.timerVibration} onChange={(e) => { apply(!!draft.timerSound, e.target.checked); if (e.target.checked) navigator.vibrate(80); }} data-testid="toggle-rest-vibration"/>Vibrate when rest ends</label>}
        <p className="text-[10px] leading-relaxed text-[hsl(var(--muted-foreground))]">The countdown uses the clock, so it stays correct after a reload. Tone and vibration only fire while CoachAura is open and awake; they can be blocked by the device when the screen is off.</p>
      </div>
    </div>}
  </div>;
}
