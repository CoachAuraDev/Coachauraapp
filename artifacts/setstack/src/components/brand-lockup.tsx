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
      <span
        className={`display-font font-bold leading-none tracking-tight text-[hsl(var(--sidebar-primary))] ${
          compact ? "text-lg" : "text-xl"
        }`}
      >
        CoachAura
      </span>
      <Dumbbell
        aria-hidden="true"
        size={compact ? 18 : 21}
        strokeWidth={2.4}
        className="mt-2.5 text-[hsl(var(--sidebar-primary))]"
      />
    </Link>
  );
}
