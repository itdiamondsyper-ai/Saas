import "server-only";
import type { z } from "zod";
import { getBackend } from "@/lib/backend";
import { PlanLimitError, NotFoundError, UserFacingError } from "@/lib/server/errors";
import type { WorkspaceContext } from "@/lib/server/context";
import { PLANS } from "@/lib/plans";
import type { clientSchema } from "@/lib/validation/schemas";
import type { ClientRow, ClientStatus, InvoiceRow, ProjectRow } from "@/types/database";
import { listActivity, logActivity } from "./activity";
import { adminIds, notify } from "./notifications";
import { memberMap, personRef } from "./members";

type ClientData = z.output<typeof clientSchema>;

export const ACTIVE_PROJECT_STATUSES = ["planning", "active", "in_review"] as const;

export interface ClientListItem extends ClientRow {
  totalRevenue: number;
  activeProjects: number;
}

export type ClientSort = "company" | "contact_name" | "status" | "revenue" | "projects" | "last_activity_at" | "created_at";

export interface ClientQuery {
  q?: string;
  status?: ClientStatus | "all";
  sort?: ClientSort;
  dir?: "asc" | "desc";
  page?: number;
  pageSize?: number;
}

function revenueByClient(invoices: InvoiceRow[]) {
  const map = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.status === "paid") map.set(inv.client_id, (map.get(inv.client_id) ?? 0) + Number(inv.subtotal));
  }
  return map;
}

export async function listClients(ctx: WorkspaceContext, query: ClientQuery = {}) {
  const ws = ctx.workspace.id;
  const [{ rows: clients }, { rows: invoices }, { rows: projects }] = await Promise.all([
    ctx.db.select("clients", {
      eq: { workspace_id: ws, ...(query.status && query.status !== "all" ? { status: query.status } : {}) },
      ...(query.status ? {} : { neq: { status: "archived" } }),
      ...(query.q ? { search: { columns: ["company", "contact_name", "email", "industry"], term: query.q } } : {}),
    }),
    ctx.db.select("invoices", { eq: { workspace_id: ws, status: "paid" } }),
    ctx.db.select("projects", { eq: { workspace_id: ws }, in: { status: [...ACTIVE_PROJECT_STATUSES] } }),
  ]);

  const revenue = revenueByClient(invoices);
  const items: ClientListItem[] = clients.map((c) => ({
    ...c,
    totalRevenue: revenue.get(c.id) ?? 0,
    activeProjects: projects.filter((p) => p.client_id === c.id).length,
  }));

  const sort = query.sort ?? "company";
  const factor = query.dir === "desc" ? -1 : 1;
  const value = (c: ClientListItem): string | number => {
    switch (sort) {
      case "revenue":
        return c.totalRevenue;
      case "projects":
        return c.activeProjects;
      default:
        return (c[sort] ?? "") as string;
    }
  };
  items.sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb));
    return cmp * factor;
  });

  const pageSize = Math.min(Math.max(query.pageSize ?? 10, 5), 100);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.min(Math.max(query.page ?? 1, 1), totalPages);
  return {
    rows: items.slice((page - 1) * pageSize, page * pageSize),
    total: items.length,
    page,
    pageSize,
    totalPages,
  };
}

export async function getClientOrThrow(ctx: WorkspaceContext, id: string): Promise<ClientRow> {
  const client = await ctx.db.first("clients", { eq: { id, workspace_id: ctx.workspace.id } });
  if (!client) throw new NotFoundError("That client doesn't exist or was deleted.");
  return client;
}

export async function getClientDetail(ctx: WorkspaceContext, id: string) {
  const ws = ctx.workspace.id;
  const client = await ctx.db.first("clients", { eq: { id, workspace_id: ws } });
  if (!client) return null;
  const [{ rows: projects }, { rows: invoices }, { rows: files }, people] = await Promise.all([
    ctx.db.select("projects", { eq: { workspace_id: ws, client_id: id }, order: [{ column: "created_at", ascending: false }] }),
    ctx.db.select("invoices", { eq: { workspace_id: ws, client_id: id }, order: [{ column: "issue_date", ascending: false }] }),
    ctx.db.select("files", { eq: { workspace_id: ws, client_id: id }, order: [{ column: "created_at", ascending: false }] }),
    memberMap(ctx),
  ]);
  const relatedIds = [id, ...projects.map((p) => p.id), ...invoices.map((i) => i.id)];
  const activity = await listActivity(ctx, { entityIds: relatedIds, limit: 15 });
  const paid = invoices.filter((i) => i.status === "paid");
  const outstanding = invoices.filter((i) => i.status === "sent" || i.status === "overdue");
  return {
    client,
    owner: personRef(client.owner_id ? people.get(client.owner_id) : undefined),
    projects: projects.map((p: ProjectRow) => ({ ...p, owner: personRef(p.owner_id ? people.get(p.owner_id) : undefined) })),
    invoices,
    files: files.map((f) => ({ ...f, uploader: personRef(f.uploaded_by ? people.get(f.uploaded_by) : undefined) })),
    activity: activity.items,
    lifetimeRevenue: paid.reduce((sum, i) => sum + Number(i.subtotal), 0),
    outstandingAmount: outstanding.reduce((sum, i) => sum + Number(i.total), 0),
  };
}

async function assertClientLimit(ctx: WorkspaceContext) {
  const limit = PLANS[ctx.plan].limits.clients;
  if (!Number.isFinite(limit)) return;
  const { count } = await ctx.db.select("clients", {
    eq: { workspace_id: ctx.workspace.id },
    neq: { status: "archived" },
    limit: 1,
  });
  if (count >= limit) {
    throw new PlanLimitError(`The ${PLANS[ctx.plan].name} plan includes up to ${limit} clients. Upgrade to Pro for unlimited clients.`);
  }
}

export async function createClient(ctx: WorkspaceContext, data: ClientData) {
  await assertClientLimit(ctx);
  const client = await ctx.db.insert("clients", {
    workspace_id: ctx.workspace.id,
    company: data.company,
    contact_name: data.contactName,
    email: data.email,
    phone: data.phone,
    website: data.website,
    industry: data.industry,
    address: data.address,
    status: data.status,
    tags: data.tags,
    notes: data.notes,
    owner_id: ctx.user.id,
    last_activity_at: new Date().toISOString(),
  });
  await logActivity(ctx, "client.created", { type: "client", id: client.id, name: client.company });
  await notify(ctx, await adminIds(ctx), {
    type: "client_added",
    title: `New client: ${client.company}`,
    body: `${ctx.profile.full_name || ctx.profile.email} added ${client.company} as ${client.status === "lead" ? "a lead" : "a client"}.`,
    link: `/dashboard/clients/${client.id}`,
  });
  return client;
}

export async function updateClient(ctx: WorkspaceContext, id: string, data: ClientData) {
  const existing = await getClientOrThrow(ctx, id);
  const [client] = await ctx.db.update(
    "clients",
    { eq: { id, workspace_id: ctx.workspace.id } },
    {
      company: data.company,
      contact_name: data.contactName,
      email: data.email,
      phone: data.phone,
      website: data.website,
      industry: data.industry,
      address: data.address,
      status: data.status,
      tags: data.tags,
      notes: data.notes,
      last_activity_at: new Date().toISOString(),
    },
  );
  const action = existing.status !== "archived" && data.status === "archived" ? "client.archived" : "client.updated";
  await logActivity(ctx, action, { type: "client", id, name: client.company });
  return client;
}

export async function setClientStatus(ctx: WorkspaceContext, id: string, status: ClientStatus) {
  const existing = await getClientOrThrow(ctx, id);
  if (existing.status === "archived" && status !== "archived") await assertClientLimit(ctx);
  await ctx.db.update("clients", { eq: { id, workspace_id: ctx.workspace.id } }, { status });
  await logActivity(ctx, status === "archived" ? "client.archived" : "client.updated", { type: "client", id, name: existing.company });
}

export async function deleteClient(ctx: WorkspaceContext, id: string) {
  const existing = await getClientOrThrow(ctx, id);
  const { count } = await ctx.db.select("invoices", { eq: { workspace_id: ctx.workspace.id, client_id: id }, limit: 1 });
  if (count > 0) {
    throw new UserFacingError(
      `${existing.company} has ${count} invoice${count === 1 ? "" : "s"}, so it can't be deleted. Archive the client instead to keep your financial history intact.`,
    );
  }
  const { rows: files } = await ctx.db.select("files", { eq: { workspace_id: ctx.workspace.id, client_id: id } });
  await ctx.db.remove("clients", { eq: { id, workspace_id: ctx.workspace.id } });
  if (files.length) await (await getBackend().storage()).removePrivate(files.map((f) => f.storage_path));
  await logActivity(ctx, "client.deleted", { type: "client", id: null, name: existing.company });
}

export async function touchClient(ctx: WorkspaceContext, clientId: string | null) {
  if (!clientId) return;
  await ctx.db.update("clients", { eq: { id: clientId, workspace_id: ctx.workspace.id } }, { last_activity_at: new Date().toISOString() });
}

export async function clientOptions(ctx: WorkspaceContext) {
  const { rows } = await ctx.db.select("clients", {
    eq: { workspace_id: ctx.workspace.id },
    neq: { status: "archived" },
    order: [{ column: "company" }],
  });
  return rows.map((c) => ({ id: c.id, label: c.company }));
}
