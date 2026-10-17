import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

const PALETTE = [
  "bg-[oklch(0.9_0.05_275)] text-[oklch(0.35_0.12_275)]",
  "bg-[oklch(0.9_0.05_185)] text-[oklch(0.35_0.08_185)]",
  "bg-[oklch(0.92_0.06_75)] text-[oklch(0.4_0.1_60)]",
  "bg-[oklch(0.9_0.05_15)] text-[oklch(0.4_0.12_15)]",
  "bg-[oklch(0.9_0.05_240)] text-[oklch(0.35_0.1_240)]",
  "bg-[oklch(0.9_0.05_320)] text-[oklch(0.38_0.12_320)]",
];

function colorFor(seed: string) {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function UserAvatar({
  name,
  src,
  size = "default",
  className,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const label = name || "Unknown";
  return (
    <Avatar size={size} className={className}>
      {src ? <AvatarImage src={src} alt={label} /> : null}
      <AvatarFallback className={cn("font-medium", colorFor(label))}>{initials(label)}</AvatarFallback>
    </Avatar>
  );
}

export function CompanyAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold ring-1 ring-foreground/5",
        colorFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
