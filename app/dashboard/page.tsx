import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CheckSquare, FileText, FolderKanban, Plus, Receipt } from "lucide-react";
import { DonutChart, RevenueAreaChart, SimpleBarChart } from "@/components/charts/charts";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { daysBetween, todayString } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { getDashboardOverview } from "@/lib/services/analytics";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Overview" };

function dueLabel(dueDate: string) {
  const days = daysBetween(todayString(), dueDate);
  if (days < 0) return { text: `${-days}d overdue`, tone: "text-destructive" };
  if (days === 0) return { text: "Due today", tone: "text-warning" };
  if (days === 1) return { text: "Tomorrow", tone: "text-warning" };
  return { text: `In ${days} days`, tone: "text-muted-foreground" };
}

export default async function OverviewPage() {
  const ctx = await requireWorkspace();
  const data = await getDashboardOverview(ctx);
  const firstName = ctx.profile.full_name.split(" ")[0] || "there";
  const canWrite = can(ctx.role, "records:write");

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`Here's what's happening at ${ctx.workspace.name} today.`}
        actions={
          canWrite && (
            <>
              <Link href="/dashboard/invoices/new" className={buttonVariants({ variant: "outline" })}>
                <Receipt /> New invoice
              </Link>
              <Link href="/dashboard/projects?new=1" className={buttonVariants()}>
                <Plus /> New project
              </Link>
            </>
          )
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-5">
        {data.kpis.map((k) => (
          <KpiCard key={k.key} label={k.label} value={k.value} format={k.format} change={k.change} positiveIsGood={k.positiveIsGood} hint={k.hint} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Revenue" description="Paid invoices, excluding tax · last 12 months" className="lg:col-span-2">
          <RevenueAreaChart data={data.revenueSeries} xKey="month" series={[{ key: "revenue", label: "Revenue" }]} label="Monthly revenue for the last 12 months" />
        </Panel>
        <Panel title="Project status" description="All projects by health">
          {data.projectStatus.some((s) => s.value > 0) ? (
            <DonutChart
              data={data.projectStatus}
              label="Projects by status"
              colors={["var(--chart-1)", "var(--chart-4)", "var(--chart-2)", "var(--muted-foreground)"]}
            />
          ) : (
            <EmptyState icon={FolderKanban} title="No projects yet" description="Create a project to see its status here." compact />
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Client growth" description="Total clients and new clients per month" className="lg:col-span-2">
          <SimpleBarChart
            data={data.clientGrowth}
            xKey="month"
            format="number"
            series={[
              { key: "total", label: "Total clients", color: "var(--chart-1)" },
              { key: "new", label: "New clients", color: "var(--chart-2)" },
            ]}
            label="Client growth over the last 12 months"
          />
        </Panel>
        <Panel
          title="Recent activity"
          action={
            <Link href="/dashboard/activity" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          }
        >
          <ActivityFeed items={data.activity} />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Upcoming deadlines"
          description="Next 14 days"
          action={
            <Link href="/dashboard/tasks" className="text-xs font-medium text-primary hover:underline">
              All tasks
            </Link>
          }
          bodyClassName="px-2 sm:px-3"
        >
          {data.deadlines.length ? (
            <ul className="divide-y">
              {data.deadlines.map((d) => {
                const due = dueLabel(d.dueDate);
                return (
                  <li key={`${d.kind}-${d.id}`}>
                    <Link href={d.href} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        {d.kind === "project" ? <FolderKanban className="size-4" /> : <CheckSquare className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{d.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">{d.context ?? (d.kind === "project" ? "Project" : "Task")}</span>
                      </span>
                      {d.assignee && <UserAvatar name={d.assignee.name} src={d.assignee.avatarUrl} size="sm" />}
                      <span className={cn("w-24 text-right text-xs font-medium", due.tone)}>{due.text}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState icon={CalendarClock} title="Nothing due soon" description="Deadlines for the next two weeks show up here." compact />
          )}
        </Panel>
        <Panel
          title="Outstanding invoices"
          description="Sent and overdue"
          action={
            <Link href="/dashboard/invoices?status=outstanding" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          }
          bodyClassName="px-2 sm:px-3"
        >
          {data.outstandingInvoices.length ? (
            <ul className="divide-y">
              {data.outstandingInvoices.map((inv) => (
                <li key={inv.id}>
                  <Link href={`/dashboard/invoices/${inv.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <FileText className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{inv.client}</span>
                      <span className="block text-xs text-muted-foreground">
                        {inv.number} · due {formatDate(inv.dueDate)}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-medium tabular">{formatCurrency(inv.total, "USD", { cents: true })}</span>
                      <span className={cn("block text-xs", inv.overdue ? "text-destructive" : "text-muted-foreground")}>
                        {inv.overdue ? "Overdue" : "Sent"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={FileText} title="No outstanding invoices" description="You're fully paid up." compact />
          )}
        </Panel>
      </div>
    </div>
  );
}
