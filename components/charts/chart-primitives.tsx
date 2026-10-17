"use client";

import type { TooltipContentProps } from "recharts";
import { formatCurrency, formatNumber } from "@/lib/format";

export const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--muted-foreground)"];

export const axisProps = {
  stroke: "var(--muted-foreground)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

export function currencyTick(value: number) {
  return formatCurrency(value, "USD", { compact: true });
}

type ValueFormat = "currency" | "number";

export function ChartTooltip({
  active,
  payload,
  label,
  format = "currency",
}: Partial<TooltipContentProps<number, string>> & { format?: ValueFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-36 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      {label !== undefined && <p className="mb-1.5 font-medium text-popover-foreground">{String(label)}</p>}
      <ul className="space-y-1">
        {payload.map((item) => (
          <li key={String(item.dataKey ?? item.name)} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-full" style={{ background: item.color ?? item.payload?.fill }} />
              {item.name}
            </span>
            <span className="font-medium text-popover-foreground tabular">
              {format === "currency" ? formatCurrency(Number(item.value)) : formatNumber(Number(item.value))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
