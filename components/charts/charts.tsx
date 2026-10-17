"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatNumber } from "@/lib/format";
import { CHART_COLORS, ChartLegend, ChartTooltip, axisProps, currencyTick } from "./chart-primitives";

export interface SeriesDef {
  key: string;
  label: string;
  color?: string;
}

function ChartFrame({ height = 260, label, children }: { height?: number; label: string; children: React.ReactElement }) {
  return (
    <div role="img" aria-label={label} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

export function RevenueAreaChart({ data, xKey, series, height, label }: { data: Record<string, number | string>[]; xKey: string; series: SeriesDef[]; height?: number; label: string }) {
  return (
    <div className="space-y-3">
      {series.length > 1 && <ChartLegend items={series.map((s, i) => ({ label: s.label, color: s.color ?? CHART_COLORS[i] }))} />}
      <ChartFrame height={height} label={label}>
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.key} id={`fill-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0.22} />
                <stop offset="100%" stopColor={s.color ?? CHART_COLORS[i]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={16} />
          <YAxis {...axisProps} tickFormatter={currencyTick} width={56} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "var(--border)" }} />
          {series.map((s, i) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.label}
              stroke={s.color ?? CHART_COLORS[i]}
              strokeWidth={2}
              fill={`url(#fill-${s.key})`}
              activeDot={{ r: 4 }}
            />
          ))}
        </AreaChart>
      </ChartFrame>
    </div>
  );
}

export function SimpleBarChart({
  data,
  xKey,
  series,
  height,
  label,
  format = "currency",
  stacked = false,
  layout = "horizontal",
}: {
  data: Record<string, number | string>[];
  xKey: string;
  series: SeriesDef[];
  height?: number;
  label: string;
  format?: "currency" | "number";
  stacked?: boolean;
  layout?: "horizontal" | "vertical";
}) {
  const vertical = layout === "vertical";
  return (
    <div className="space-y-3">
      {series.length > 1 && <ChartLegend items={series.map((s, i) => ({ label: s.label, color: s.color ?? CHART_COLORS[i] }))} />}
      <ChartFrame height={height} label={label}>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 8, left: vertical ? 8 : -8, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={vertical} horizontal={!vertical} stroke="var(--border)" />
          {vertical ? (
            <>
              <XAxis type="number" {...axisProps} tickFormatter={format === "currency" ? currencyTick : (v) => formatNumber(v)} />
              <YAxis type="category" dataKey={xKey} {...axisProps} width={120} tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)} />
            </>
          ) : (
            <>
              <XAxis dataKey={xKey} {...axisProps} minTickGap={8} />
              <YAxis {...axisProps} tickFormatter={format === "currency" ? currencyTick : (v) => formatNumber(v)} width={format === "currency" ? 56 : 32} allowDecimals={false} />
            </>
          )}
          <Tooltip content={<ChartTooltip format={format} />} cursor={{ fill: "var(--muted)", opacity: 0.5 }} />
          {series.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              fill={s.color ?? CHART_COLORS[i]}
              stackId={stacked ? "stack" : undefined}
              radius={stacked ? (i === series.length - 1 ? (vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0) : vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={36}
            />
          ))}
        </BarChart>
      </ChartFrame>
    </div>
  );
}

export function SimpleLineChart({ data, xKey, series, height, label, format = "number" }: { data: Record<string, number | string>[]; xKey: string; series: SeriesDef[]; height?: number; label: string; format?: "currency" | "number" }) {
  return (
    <div className="space-y-3">
      {series.length > 1 && <ChartLegend items={series.map((s, i) => ({ label: s.label, color: s.color ?? CHART_COLORS[i] }))} />}
      <ChartFrame height={height} label={label}>
        <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis dataKey={xKey} {...axisProps} minTickGap={16} />
          <YAxis {...axisProps} allowDecimals={false} width={40} tickFormatter={format === "currency" ? currencyTick : undefined} />
          <Tooltip content={<ChartTooltip format={format} />} cursor={{ stroke: "var(--border)" }} />
          {series.map((s, i) => (
            <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color ?? CHART_COLORS[i]} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
          ))}
        </LineChart>
      </ChartFrame>
    </div>
  );
}

export function DonutChart({ data, label, height = 220, colors }: { data: { name: string; value: number }[]; label: string; height?: number; colors?: string[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const palette = colors ?? CHART_COLORS;
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto]">
      <div className="relative">
        <ChartFrame height={height} label={label}>
          <PieChart>
            <Tooltip content={<ChartTooltip format="number" />} />
            <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={2} strokeWidth={0}>
              {data.map((entry, i) => (
                <Cell key={entry.name} fill={palette[i % palette.length]} />
              ))}
            </Pie>
          </PieChart>
        </ChartFrame>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold tabular">{total}</span>
          <span className="text-xs text-muted-foreground">total</span>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-1">
        {data.map((d, i) => (
          <li key={d.name} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: palette[i % palette.length] }} aria-hidden />
            <span className="text-muted-foreground">{d.name}</span>
            <span className="ml-auto font-medium tabular">{d.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
