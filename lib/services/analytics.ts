import "server-only";
import { addDays, lastMonthKeys, monthKey, monthLabel, startOfMonthUTC, todayString, toDateString } from "@/lib/dates";
import { percentChange } from "@/lib/format";
import { healthBucket, type HealthBucket } from "@/lib/project-health";
import type { WorkspaceContext } from "@/lib/server/context";
import type { ExpenseRow, InvoiceRow } from "@/types/database";
import { listActivity } from "./activity";
import { ACTIVE_PROJECT_STATUSES } from "./clients";
import { memberMap, personRef } from "./members";

const sum = (values: number[]) => values.reduce((s, v) => s + v, 0);
const within = (iso: string | null, start: Date, end: Date) => !!iso && new Date(iso) >= start && new Date(iso) < end;

async function loadWorkspaceData(ctx: WorkspaceContext) {
  const ws = ctx.workspace.id;
  const [invoices, clients, projects, tasks, expenses] = await Promise.all([
    ctx.db.select("invoices", { eq: { workspace_id: ws } }),
    ctx.db.select("clients", { eq: { workspace_id: ws } }),
    ctx.db.select("projects", { eq: { workspace_id: ws } }),
    ctx.db.select("tasks", { eq: { workspace_id: ws } }),
    ctx.db.select("expenses", { eq: { workspace_id: ws } }),
  ]);
  return { invoices: invoices.rows, clients: clients.rows, projects: projects.rows, tasks: tasks.rows, expenses: expenses.rows };
}

function paidRevenue(invoices: InvoiceRow[], start: Date, end: Date) {
  return sum(invoices.filter((i) => i.status === "paid" && within(i.paid_at, start, end)).map((i) => Number(i.subtotal)));
}

/** Outstanding balance as it stood at `at`: sent before then and not yet paid or cancelled at that time. */
function outstandingAt(invoices: InvoiceRow[], at: Date) {
  return sum(
    invoices
      .filter((i) => i.sent_at && new Date(i.sent_at) < at)
      .filter((i) => i.status !== "cancelled" && i.status !== "draft")
      .filter((i) => !i.paid_at || new Date(i.paid_at) >= at)
      .map((i) => Number(i.total)),
  );
}

export interface Kpi {
  key: string;
  label: string;
  value: number;
  format: "currency" | "number";
  change: number | null;
  /** Whether an increase is good news (outstanding invoices going up is not). */
  positiveIsGood: boolean;
  hint: string;
}

export async function getDashboardOverview(ctx: WorkspaceContext) {
  const now = new Date();
  const { invoices, clients, projects, tasks } = await loadWorkspaceData(ctx);
  const monthStart = startOfMonthUTC(now);
  const prevMonthStart = startOfMonthUTC(now, -1);

  const revenue = paidRevenue(invoices, monthStart, now);
  const prevRevenue = paidRevenue(invoices, prevMonthStart, monthStart);

  const outstandingNow = sum(invoices.filter((i) => i.status === "sent" || i.status === "overdue").map((i) => Number(i.total)));
  const outstandingPrev = outstandingAt(invoices, monthStart);

  const activeClients = clients.filter((c) => c.status === "active");
  const activeClientsPrev = activeClients.filter((c) => new Date(c.created_at) < monthStart).length;

  const activeProjects = projects.filter((p) => (ACTIVE_PROJECT_STATUSES as readonly string[]).includes(p.status));
  const activeProjectsPrev = activeProjects.filter((p) => new Date(p.created_at) < monthStart).length;

  const today = todayString(now);
  const weekEnd = toDateString(addDays(now, 7));
  const lastWeekStart = toDateString(addDays(now, -7));
  const dueThisWeek = tasks.filter((t) => t.status !== "done" && t.due_date && t.due_date >= today && t.due_date <= weekEnd);
  const dueLastWeek = tasks.filter((t) => t.due_date && t.due_date >= lastWeekStart && t.due_date < today);

  const kpis: Kpi[] = [
    {
      key: "revenue", label: "Revenue this month", value: revenue, format: "currency",
      change: percentChange(revenue, prevRevenue),
      positiveIsGood: true, hint: "vs. last month",
    },
    {
      key: "outstanding", label: "Outstanding invoices", value: outstandingNow, format: "currency",
      change: percentChange(outstandingNow, outstandingPrev), positiveIsGood: false, hint: "vs. start of month",
    },
    {
      key: "clients", label: "Active clients", value: activeClients.length, format: "number",
      change: percentChange(activeClients.length, activeClientsPrev), positiveIsGood: true, hint: "vs. last month",
    },
    {
      key: "projects", label: "Active projects", value: activeProjects.length, format: "number",
      change: percentChange(activeProjects.length, activeProjectsPrev), positiveIsGood: true, hint: "vs. last month",
    },
    {
      key: "tasks", label: "Tasks due this week", value: dueThisWeek.length, format: "number",
      change: percentChange(dueThisWeek.length, dueLastWeek.length), positiveIsGood: false, hint: "vs. last week",
    },
  ];

  const months = lastMonthKeys(12, now);
  const revenueSeries = months.map((key) => ({
    month: monthLabel(key),
    revenue: sum(invoices.filter((i) => i.status === "paid" && i.paid_at && monthKey(i.paid_at) === key).map((i) => Number(i.subtotal))),
  }));

  const buckets: Record<HealthBucket, number> = { Active: 0, "At Risk": 0, Completed: 0, "On Hold": 0 };
  for (const p of projects) buckets[healthBucket(p, now)] += 1;
  const projectStatus = (Object.keys(buckets) as HealthBucket[]).map((name) => ({ name, value: buckets[name] }));

  const clientGrowth = months.map((key) => {
    const end = new Date(Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)), 1));
    return {
      month: monthLabel(key),
      total: clients.filter((c) => new Date(c.created_at) < end).length,
      new: clients.filter((c) => monthKey(c.created_at) === key).length,
    };
  });

  const people = await memberMap(ctx);
  const horizon = toDateString(addDays(now, 14));
  const deadlines = [
    ...projects
      .filter((p) => p.status !== "completed" && p.status !== "on_hold" && p.due_date && p.due_date <= horizon)
      .map((p) => ({ kind: "project" as const, id: p.id, title: p.name, dueDate: p.due_date!, href: `/dashboard/projects/${p.id}`, assignee: personRef(p.owner_id ? people.get(p.owner_id) : undefined), context: clients.find((c) => c.id === p.client_id)?.company ?? null })),
    ...tasks
      .filter((t) => t.status !== "done" && t.due_date && t.due_date <= horizon)
      .map((t) => ({ kind: "task" as const, id: t.id, title: t.title, dueDate: t.due_date!, href: `/dashboard/tasks?task=${t.id}`, assignee: personRef(t.assignee_id ? people.get(t.assignee_id) : undefined), context: projects.find((p) => p.id === t.project_id)?.name ?? null })),
  ]
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 7);

  const outstandingInvoices = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .map((i) => ({
      id: i.id,
      number: i.number,
      total: Number(i.total),
      dueDate: i.due_date,
      overdue: i.status === "overdue" || i.due_date < today,
      client: clients.find((c) => c.id === i.client_id)?.company ?? "Unknown client",
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5);

  const activity = await listActivity(ctx, { limit: 8 });

  return { kpis, revenueSeries, projectStatus, clientGrowth, deadlines, outstandingInvoices, activity: activity.items };
}

export type AnalyticsRange = "7d" | "30d" | "90d" | "1y";
export const ANALYTICS_RANGES: { value: AnalyticsRange; label: string; days: number }[] = [
  { value: "7d", label: "7 days", days: 7 },
  { value: "30d", label: "30 days", days: 30 },
  { value: "90d", label: "90 days", days: 90 },
  { value: "1y", label: "1 year", days: 365 },
];

interface Bucket {
  label: string;
  start: Date;
  end: Date;
}

function buildBuckets(range: AnalyticsRange, now: Date): Bucket[] {
  if (range === "1y") {
    return lastMonthKeys(12, now).map((key, i, arr) => {
      const start = new Date(`${key}-01T00:00:00Z`);
      const end = i === arr.length - 1 ? now : new Date(`${arr[i + 1]}-01T00:00:00Z`);
      return { label: monthLabel(key), start, end };
    });
  }
  const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
  const step = range === "90d" ? 7 : 1;
  const count = Math.ceil(days / step);
  const todayStart = new Date(`${todayString(now)}T00:00:00Z`);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(todayStart, -(count - 1 - i) * step - (step - 1));
    const end = i === count - 1 ? now : addDays(start, step);
    return {
      label: start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }),
      start,
      end,
    };
  });
}

function expensesBetween(expenses: ExpenseRow[], start: Date, end: Date) {
  const from = toDateString(start);
  const to = toDateString(end);
  const includeEndDay = end.getTime() >= Date.now() - 60_000;
  return sum(
    expenses
      .filter((x) => x.incurred_on >= from && (includeEndDay ? x.incurred_on <= to : x.incurred_on < to))
      .map((x) => Number(x.amount)),
  );
}

export async function getAnalytics(ctx: WorkspaceContext, range: AnalyticsRange) {
  const now = new Date();
  const days = ANALYTICS_RANGES.find((r) => r.value === range)!.days;
  const start = addDays(now, -days);
  const prevStart = addDays(start, -days);
  const { invoices, clients, projects, tasks, expenses } = await loadWorkspaceData(ctx);

  const revenue = paidRevenue(invoices, start, now);
  const prevRevenue = paidRevenue(invoices, prevStart, start);
  const costs = expensesBetween(expenses, start, now);
  const prevCosts = expensesBetween(expenses, prevStart, start);
  const profit = revenue - costs;
  const prevProfit = prevRevenue - prevCosts;

  const newClients = clients.filter((c) => within(c.created_at, start, now)).length;
  const prevNewClients = clients.filter((c) => within(c.created_at, prevStart, start)).length;

  const payingIn = (from: Date, to: Date) =>
    new Set(invoices.filter((i) => i.status === "paid" && within(i.paid_at, from, to)).map((i) => i.client_id));
  const openProjectClients = new Set(
    projects.filter((p) => (ACTIVE_PROJECT_STATUSES as readonly string[]).includes(p.status)).map((p) => p.client_id),
  );
  const retentionFor = (prev: Set<string>, current: Set<string>) =>
    prev.size ? ([...prev].filter((id) => current.has(id) || openProjectClients.has(id)).length / prev.size) * 100 : null;
  // Look back over at least 90 days so short ranges still have a meaningful cohort.
  const cohortDays = Math.max(days, 90);
  const retention = retentionFor(payingIn(addDays(now, -2 * cohortDays), addDays(now, -cohortDays)), payingIn(addDays(now, -cohortDays), now));

  const overlapping = projects.filter(
    (p) => (!p.start_date || p.start_date <= todayString(now)) && (!p.due_date || p.due_date >= toDateString(start)),
  );
  const avgProjectValue = overlapping.length ? sum(overlapping.map((p) => Number(p.budget))) / overlapping.length : 0;

  const issued = invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled");
  const issuedInPeriod = issued.filter((i) => i.issue_date >= toDateString(start));
  const issuedPrev = issued.filter((i) => i.issue_date >= toDateString(prevStart) && i.issue_date < toDateString(start));
  const avgInvoice = issuedInPeriod.length ? sum(issuedInPeriod.map((i) => Number(i.total))) / issuedInPeriod.length : 0;
  const prevAvgInvoice = issuedPrev.length ? sum(issuedPrev.map((i) => Number(i.total))) / issuedPrev.length : 0;

  const outstandingList = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const outstanding = sum(outstandingList.map((i) => Number(i.total)));

  const metrics = {
    revenue: { value: revenue, change: percentChange(revenue, prevRevenue) },
    profit: { value: profit, change: percentChange(profit, prevProfit), margin: revenue ? (profit / revenue) * 100 : 0 },
    newClients: { value: newClients, change: percentChange(newClients, prevNewClients) },
    retention: { value: retention },
    avgProjectValue: { value: avgProjectValue },
    avgInvoiceValue: { value: avgInvoice, change: percentChange(avgInvoice, prevAvgInvoice) },
    outstanding: { value: outstanding, count: outstandingList.length, overdue: outstandingList.filter((i) => i.status === "overdue").length },
  };

  const buckets = buildBuckets(range, now);
  const trend = buckets.map((b) => {
    const r = paidRevenue(invoices, b.start, b.end);
    const c = expensesBetween(expenses, b.start, b.end);
    return { label: b.label, revenue: r, expenses: c, profit: r - c };
  });

  const byClient = new Map<string, number>();
  for (const i of invoices) {
    if (i.status === "paid" && within(i.paid_at, start, now)) byClient.set(i.client_id, (byClient.get(i.client_id) ?? 0) + Number(i.subtotal));
  }
  const revenueByClient = [...byClient.entries()]
    .map(([id, value]) => ({ name: clients.find((c) => c.id === id)?.company ?? "Unknown", value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const profitability = projects
    .map((p) => {
      const rev = sum(invoices.filter((i) => i.project_id === p.id && i.status === "paid").map((i) => Number(i.subtotal)));
      const cost = sum(expenses.filter((e) => e.project_id === p.id).map((e) => Number(e.amount)));
      return { name: p.name, revenue: rev, costs: cost, profit: rev - cost, margin: rev ? ((rev - cost) / rev) * 100 : 0 };
    })
    .filter((p) => p.revenue > 0 || p.costs > 0)
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 8);

  const invoiceStatus = buckets.map((b) => {
    const s = toDateString(b.start);
    const e = toDateString(b.end);
    const inBucket = issued.filter((i) => i.issue_date >= s && (i.issue_date < e || b.end === now));
    return {
      label: b.label,
      paid: sum(inBucket.filter((i) => i.status === "paid").map((i) => Number(i.total))),
      outstanding: sum(inBucket.filter((i) => i.status === "sent" || i.status === "overdue").map((i) => Number(i.total))),
    };
  });

  const acquisition = buckets.map((b) => ({ label: b.label, clients: clients.filter((c) => within(c.created_at, b.start, b.end)).length }));

  const people = await memberMap(ctx);
  const workload = [...people.values()].map((m) => {
    const open = tasks.filter((t) => t.assignee_id === m.userId && t.status !== "done");
    return {
      name: m.name.split(" ")[0],
      todo: open.filter((t) => t.status === "backlog" || t.status === "todo").length,
      inProgress: open.filter((t) => t.status === "in_progress").length,
      review: open.filter((t) => t.status === "review").length,
      completed: tasks.filter((t) => t.assignee_id === m.userId && t.status === "done" && within(t.completed_at, start, now)).length,
    };
  });

  return { metrics, trend, revenueByClient, profitability, invoiceStatus, acquisition, workload };
}

export type AnalyticsData = Awaited<ReturnType<typeof getAnalytics>>;
export type DashboardOverview = Awaited<ReturnType<typeof getDashboardOverview>>;
