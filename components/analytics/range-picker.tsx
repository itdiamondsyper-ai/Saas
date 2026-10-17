"use client";

import { useQueryState } from "@/hooks/use-query-state";
import { cn } from "@/lib/utils";

const RANGES = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
  { value: "1y", label: "1 year" },
];

export function RangePicker({ value }: { value: string }) {
  const { set, pending } = useQueryState();
  return (
    <div role="radiogroup" aria-label="Date range" className={cn("flex rounded-lg border bg-card p-0.5", pending && "opacity-70")}>
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          onClick={() => set({ range: r.value === "30d" ? null : r.value })}
          className={cn(
            "rounded-md px-3 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
            value === r.value && "bg-muted font-medium text-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
