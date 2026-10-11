import { Dumbbell } from "lucide-react";
import { Link } from "wouter";

type BrandLockupProps = {
  compact?: boolean;
  className?: string;
  testId?: string;
};

export function BrandLockup({
  compact = false,
  className = "",
  testId = "link-brand",
}: BrandLockupProps) {
  return (
    <Link
      href="/"
      aria-label="CoachAura home"
      data-testid={testId}
      className={`flex flex-col items-center text-center ${className}`}
    >
      <img
        src={`${import.meta.env.BASE_URL}coachaura-monogram.svg`}
        alt=""
        aria-hidden="true"
        className={compact ? "h-9 w-9" : "h-11 w-11"}
      />
      <span
        className={`display-font mt-1.5 font-bold leading-none tracking-tight ${
          compact ? "text-base" : "text-lg"
        }`}
      >
        CoachAura<span className="text-[hsl(var(--sidebar-primary))]">.</span>
      </span>
      <Dumbbell
        aria-hidden="true"
        size={compact ? 16 : 19}
        strokeWidth={2.5}
        className="mt-2 text-[hsl(var(--sidebar-primary))]"
      />
      {!compact && (
        <span className="mono mt-1.5 text-[9px] uppercase tracking-[.16em] text-[hsl(var(--sidebar-foreground))]/45">
          Coach&apos;s floor
        </span>
      )}
    </Link>
  );
}
