import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/constants";

const TONES: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-info/10 text-info ring-info/20",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/12 text-[color-mix(in_oklch,var(--warning),black_25%)] ring-warning/25 dark:text-warning",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  brand: "bg-primary/10 text-primary ring-primary/20",
};

export function StatusBadge({ tone, children, className, dot = true }: { tone: Tone; children: React.ReactNode; className?: string; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium whitespace-nowrap ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="size-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  );
}

export function toneText(tone: Tone) {
  return TONES[tone];
}
