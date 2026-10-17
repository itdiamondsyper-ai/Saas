import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, Lock } from "lucide-react";
import { RangePicker } from "@/components/analytics/range-picker";
import { RevenueAreaChart, SimpleBarChart, SimpleLineChart } from "@/components/charts/charts";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { requireWorkspace } from "@/lib/server/context";
import { ANALYTICS_RANGES, getAnalytics, type AnalyticsRange } from "@/lib/services/analytics";

export const metadata: Metadata = { title: "Analytics" };

export default async function AnalyticsPage({ searchParams }: PageProps<"/dashboard/analytics">) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const range: AnalyticsRange = ANALYTICS_RANGES.some((r) => r.value === sp.range) ? (sp.range as AnalyticsRange) : "30d";
  const rangeLabel = ANALYTICS_RANGES.find((r) => r.value === range)!.label;
  const data = await getAnalytics(ctx, range);
  const advanced = PLANS[ctx.plan].highlights.advancedAnalytics;
  const m = data.metrics;
  const hint = "vs. previous period";

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description={`Business performance over the last ${rangeLabel}.`} actions={<RangePicker value={range} />} />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <KpiCard label="Revenue" value={m.revenue.value} format="currency" change={m.revenue.change} hint={hint} />
        <KpiCard label="Profit" value={m.profit.value} format="currency" change={m.profit.change} hint={hint} />
        <KpiCard label="New clients" value={m.newClients.value} format="number" change={m.newClients.change} hint={hint} />
        <KpiCard
          label="Client retention"
          value={m.retention.value ?? 0}
          format="percent"
          footnote={m.retention.value === null ? "Not enough history yet" : "Clients who paid again or have open work"}
        />
        <KpiCard label="Average project value" value={m.avgProjectValue.value} format="currency" footnote="Budget of projects active in this period" />
        <KpiCard label="Average invoice value" value={m.avgInvoiceValue.value} format="currency" change={m.avgInvoiceValue.change} hint={hint} />
        <KpiCard
          label="Outstanding invoices"
          value={m.outstanding.value}
          format="currency"
          footnote={`${m.outstanding.count} open · ${m.outstanding.overdue} overdue`}
        />
        <KpiCard label="Profit margin" value={m.profit.margin} format="percent" footnote="Profit as a share of revenue" />
      </div>

      <Panel title="Revenue trend" description="Paid revenue, expenses and profit">
        {data.trend.some((t) => t.revenue || t.expenses) ? (
          <RevenueAreaChart
            data={data.trend}
            xKey="label"
            series={[
              { key: "revenue", label: "Revenue", color: "var(--chart-1)" },
              { key: "expenses", label: "Expenses", color: "var(--chart-4)" },
              { key: "profit", label: "Profit", color: "var(--chart-2)" },
            ]}
            height={280}
            label={`Revenue, expenses and profit over the last ${rangeLabel}`}
          />
        ) : (
          <EmptyState icon={BarChart3} title="No revenue in this period" description="Paid invoices will appear here." compact />
        )}
      </Panel>

      {advanced ? (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Revenue by client" description={`Top clients · last ${rangeLabel}`}>
              {data.revenueByClient.length ? (
                <SimpleBarChart data={data.revenueByClient} xKey="name" layout="vertical" series={[{ key: "value", label: "Revenue" }]} label="Revenue by client" height={240} />
              ) : (
                <EmptyState icon={BarChart3} title="No paid invoices in this period" compact />
              )}
            </Panel>
            <Panel title="Invoices paid vs outstanding" description="By issue date">
              <SimpleBarChart
                data={data.invoiceStatus}
                xKey="label"
                stacked
                series={[
                  { key: "paid", label: "Paid", color: "var(--chart-2)" },
                  { key: "outstanding", label: "Outstanding", color: "var(--chart-3)" },
                ]}
                label="Invoices paid versus outstanding"
                height={240}
              />
            </Panel>
          </div>
          <Panel title="Project profitability" description="Paid revenue minus logged expenses, all time">
            {data.profitability.length ? (
              <>
                <SimpleBarChart
                  data={data.profitability}
                  xKey="name"
                  layout="vertical"
                  series={[
                    { key: "revenue", label: "Revenue", color: "var(--chart-1)" },
                    { key: "costs", label: "Costs", color: "var(--chart-4)" },
                    { key: "profit", label: "Profit", color: "var(--chart-2)" },
                  ]}
                  label="Revenue, costs and profit by project"
                  height={Math.max(220, data.profitability.length * 44)}
                />
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr className="border-b">
                        <th scope="col" className="py-2 font-medium">Project</th>
                        <th scope="col" className="py-2 text-right font-medium">Revenue</th>
                        <th scope="col" className="py-2 text-right font-medium">Costs</th>
                        <th scope="col" className="py-2 text-right font-medium">Profit</th>
                        <th scope="col" className="py-2 text-right font-medium">Margin</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {data.profitability.map((p) => (
                        <tr key={p.name}>
                          <td className="py-2">{p.name}</td>
                          <td className="py-2 text-right tabular">{formatCurrency(p.revenue)}</td>
                          <td className="py-2 text-right tabular">{formatCurrency(p.costs)}</td>
                          <td className={`py-2 text-right font-medium tabular ${p.profit < 0 ? "text-destructive" : ""}`}>{formatCurrency(p.profit)}</td>
                          <td className="py-2 text-right tabular">{p.revenue ? `${p.margin.toFixed(0)}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState icon={BarChart3} title="No project revenue or costs yet" compact />
            )}
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Client acquisition" description="New clients added">
              <SimpleLineChart data={data.acquisition} xKey="label" series={[{ key: "clients", label: "New clients" }]} label="New clients over time" height={220} />
            </Panel>
            <Panel title="Workload by team member" description="Open tasks by stage">
              <SimpleBarChart
                data={data.workload}
                xKey="name"
                stacked
                format="number"
                series={[
                  { key: "todo", label: "To do", color: "var(--chart-5)" },
                  { key: "inProgress", label: "In progress", color: "var(--chart-1)" },
                  { key: "review", label: "In review", color: "var(--chart-3)" },
                ]}
                label="Open tasks per team member"
                height={220}
              />
            </Panel>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-10 text-center">
          <Lock className="size-6 text-muted-foreground" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium">Advanced analytics are on Pro and Business</p>
            <p className="text-sm text-muted-foreground">Unlock revenue by client, project profitability, client acquisition and team workload.</p>
          </div>
          <Link href="/dashboard/settings?tab=billing" className={buttonVariants()}>
            Upgrade plan
          </Link>
        </div>
      )}
    </div>
  );
}
