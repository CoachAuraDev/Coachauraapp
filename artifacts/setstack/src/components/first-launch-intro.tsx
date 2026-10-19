import { useEffect, useRef, useState } from "react";
import { DumbbellMark } from "@/components/brand-lockup";
import { primaryBtn } from "@/components/workout/shared";

type Stage = "splash" | "welcome";

export function FirstLaunchIntro({ onComplete }: { onComplete: () => void }) {
  const [stage, setStage] = useState<Stage>("splash");
  const completed = useRef(false);

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setStage("welcome");
      return;
    }
    const timer = window.setTimeout(() => setStage("welcome"), 2500);
    return () => window.clearTimeout(timer);
  }, []);

  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  };

  return (
    <main
      className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center bg-[hsl(var(--background))] px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))] text-[hsl(var(--foreground))]"
      data-testid="first-launch-intro"
    >
      {stage === "splash" && <button
        type="button"
        className="absolute right-5 top-[max(24px,env(safe-area-inset-top))] inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-[hsl(var(--muted-foreground))] transition hover:text-[hsl(var(--foreground))]"
        onClick={finish}
        data-testid="button-intro-skip"
      >
        Skip
      </button>}
      {stage === "splash" ? (
        <section className="relative flex w-full max-w-md flex-col items-center text-center" aria-label="CoachAura introduction animation">
          <div className="intro-mark-glow flex h-24 w-full items-center justify-center">
            <DumbbellMark className="intro-mark h-14 w-[210px] text-[hsl(var(--primary))]" />
          </div>
          <p className="intro-wordmark mt-5 text-3xl font-semibold tracking-tight text-[hsl(var(--primary))]" data-testid="intro-wordmark">CoachAura</p>
        </section>
      ) : (
        <section className="intro-welcome w-full max-w-md text-center" data-testid="intro-welcome">
          <DumbbellMark className="mx-auto h-12 w-[180px] text-[hsl(var(--primary))]" />
          <p className="mt-4 text-lg font-semibold tracking-wide text-[hsl(var(--primary))]">CoachAura</p>
          <h1 className="display-font mt-10 text-[clamp(2.35rem,8vw,3.4rem)] font-semibold leading-[1.08] tracking-[-.045em]">
            Your clients.<br />Your data.<br />No subscriptions.
          </h1>
          <p className="mx-auto mt-5 max-w-sm text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
            Track workouts, manage clients and monitor progress — all in one streamlined app.
          </p>
          <button
            type="button"
            className={`${primaryBtn} mx-auto mt-9 min-h-12 w-full max-w-xs text-base`}
            onClick={finish}
            data-testid="button-intro-get-started"
          >
            Get Started
          </button>
        </section>
      )}
    </main>
  );
}
