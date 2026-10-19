import { Link } from "wouter";

type BrandLockupProps = {
  compact?: boolean;
  className?: string;
  testId?: string;
};

export function DumbbellMark({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 196 52"
      className={className}
      fill="currentColor"
    >
      <rect x="22" y="22" width="152" height="8" rx="4" />
      <rect x="16" y="0" width="8" height="52" rx="3" />
      <rect x="172" y="0" width="8" height="52" rx="3" />
      <rect x="7" y="8" width="6" height="36" rx="2.5" />
      <rect x="183" y="8" width="6" height="36" rx="2.5" />
      <rect x="0" y="18" width="4" height="16" rx="1.5" />
      <rect x="192" y="18" width="4" height="16" rx="1.5" />
    </svg>
  );
}

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
        className={`font-sans font-light leading-none tracking-[0.01em] text-[hsl(var(--sidebar-primary))] ${
          compact ? "text-lg" : "text-xl"
        }`}
      >
        CoachAura
      </span>
      <DumbbellMark
        className={`mt-1.5 text-[hsl(var(--sidebar-primary))] ${
          compact ? "h-[13px] w-[49px]" : "h-4 w-[61px]"
        }`}
      />
    </Link>
  );
}
