import "server-only";
import { CLIENT_STATUSES, INVOICE_STATUSES, PROJECT_STATUSES, TASK_STATUSES, lookup } from "@/lib/constants";
import { formatCurrency } from "@/lib/format";
import type { WorkspaceContext } from "@/lib/server/context";

export interface SearchResult {
  type: "client" | "project" | "task" | "invoice";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

const LIMIT = 5;

export async function searchWorkspace(ctx: WorkspaceContext, rawQuery: string): Promise<SearchResult[]> {
  const q = rawQuery.trim().slice(0, 100);
  if (q.length < 1) return [];
  const ws = ctx.workspace.id;
  const [clients, projects, tasks, invoices, allClients] = await Promise.all([
    ctx.db.select("clients", { eq: { workspace_id: ws }, search: { columns: ["company", "contact_name", "email"], term: q }, limit: LIMIT }),
    ctx.db.select("projects", { eq: { workspace_id: ws }, search: { columns: ["name", "description"], term: q }, limit: LIMIT }),
    ctx.db.select("tasks", { eq: { workspace_id: ws }, search: { columns: ["title", "description"], term: q }, limit: LIMIT }),
    ctx.db.select("invoices", { eq: { workspace_id: ws }, search: { columns: ["number", "notes"], term: q }, limit: LIMIT }),
    ctx.db.select("clients", { eq: { workspace_id: ws } }),
  ]);

  // Invoices are also found by their client's name.
  const matchingClientIds = allClients.rows
    .filter((c) => c.company.toLowerCase().includes(q.toLowerCase()))
    .map((c) => c.id);
  const byClient = matchingClientIds.length
    ? (await ctx.db.select("invoices", { eq: { workspace_id: ws }, in: { client_id: matchingClientIds }, order: [{ column: "issue_date", ascending: false }], limit: LIMIT })).rows
    : [];
  const invoiceRows = [...invoices.rows, ...byClient.filter((i) => !invoices.rows.some((x) => x.id === i.id))].slice(0, LIMIT);
  const companyOf = (id: string | null) => allClients.rows.find((c) => c.id === id)?.company;

  return [
    ...clients.rows.map((c) => ({
      type: "client" as const,
      id: c.id,
      title: c.company,
      subtitle: `${c.contact_name} · ${lookup(CLIENT_STATUSES, c.status).label}`,
      href: `/dashboard/clients/${c.id}`,
    })),
    ...projects.rows.map((p) => ({
      type: "project" as const,
      id: p.id,
      title: p.name,
      subtitle: [companyOf(p.client_id), lookup(PROJECT_STATUSES, p.status).label].filter(Boolean).join(" · "),
      href: `/dashboard/projects/${p.id}`,
    })),
    ...tasks.rows.map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      subtitle: lookup(TASK_STATUSES, t.status).label + (t.due_date ? ` · due ${t.due_date}` : ""),
      href: `/dashboard/tasks?task=${t.id}`,
    })),
    ...invoiceRows.map((i) => ({
      type: "invoice" as const,
      id: i.id,
      title: i.number,
      subtitle: `${companyOf(i.client_id) ?? "Unknown client"} · ${formatCurrency(Number(i.total))} · ${lookup(INVOICE_STATUSES, i.status).label}`,
      href: `/dashboard/invoices/${i.id}`,
    })),
  ];
}
