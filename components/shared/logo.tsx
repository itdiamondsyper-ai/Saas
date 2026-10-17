import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <path
        d="M9 21.5 15.2 10l3.1 5.6L20.6 12 23 21.5h-3.3l-1.2-4.4-2.2 3.4-2.4-4.4-2.6 5.4H9Z"
        className="fill-primary-foreground"
      />
    </svg>
  );
}

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark />
      {!compact && <span className="text-[15px]">FlowPilot</span>}
    </span>
  );
}
