import "server-only";
import type { z } from "zod";
import { addDays, todayString, toDateString } from "@/lib/dates";
import { formatCurrency } from "@/lib/format";
import type { WorkspaceContext } from "@/lib/server/context";
import { NotFoundError, UserFacingError } from "@/lib/server/errors";
import { DbError } from "@/lib/db/types";
import type { invoiceSchema } from "@/lib/validation/schemas";
import type { InvoiceRow, InvoiceStatus } from "@/types/database";
import { logActivity } from "./activity";
import { touchClient } from "./clients";
import { adminIds, notify } from "./notifications";

type InvoiceData = z.output<typeof invoiceSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function computeTotals(items: { quantity: number; unitPrice: number }[], taxRate: number) {
  const lines = items.map((i) => round2(i.quantity * i.unitPrice));
  const subtotal = round2(lines.reduce((s, l) => s + l, 0));
  const tax = round2((subtotal * taxRate) / 100);
  return { lines, subtotal, tax, total: round2(subtotal + tax) };
}

/** Sent invoices past their due date become overdue. */
export async function refreshOverdue(ctx: WorkspaceContext) {
  await ctx.db.update(
    "invoices",
    { eq: { workspace_id: ctx.workspace.id, status: "sent" }, lt: { due_date: todayString() } },
    { status: "overdue" },
  );
}

export interface InvoiceQuery {
  q?: string;
  status?: InvoiceStatus | "all" | "outstanding";
  clientId?: string;
}

export async function listInvoices(ctx: WorkspaceContext, query: InvoiceQuery = {}) {
  if (ctx.role !== "viewer") await refreshOverdue(ctx);
  const ws = ctx.workspace.id;
  const [{ rows: invoices }, { rows: clients }] = await Promise.all([
    ctx.db.select("invoices", {
      eq: {
        workspace_id: ws,
        ...(query.status && !["all", "outstanding"].includes(query.status) ? { status: query.status as InvoiceStatus } : {}),
        ...(query.clientId ? { client_id: query.clientId } : {}),
      },
      ...(query.status === "outstanding" ? { in: { status: ["sent", "overdue"] } } : {}),
      order: [{ column: "issue_date", ascending: false }, { column: "number", ascending: false }],
    }),
    ctx.db.select("clients", { eq: { workspace_id: ws } }),
  ]);
  const term = query.q?.trim().toLowerCase();
  const today = todayString();
  return invoices
    .map((inv) => ({
      ...inv,
      status: (inv.status === "sent" && inv.due_date < today ? "overdue" : inv.status) as InvoiceStatus,
      client: clients.find((c) => c.id === inv.client_id) ?? null,
    }))
    .filter(
      (inv) =>
        !term ||
        inv.number.toLowerCase().includes(term) ||
        inv.client?.company.toLowerCase().includes(term) ||
        inv.client?.contact_name.toLowerCase().includes(term),
    );
}

export type InvoiceListItem = Awaited<ReturnType<typeof listInvoices>>[number];

export async function getInvoiceOrThrow(ctx: WorkspaceContext, id: string): Promise<InvoiceRow> {
  const invoice = await ctx.db.first("invoices", { eq: { id, workspace_id: ctx.workspace.id } });
  if (!invoice) throw new NotFoundError("That invoice doesn't exist or was deleted.");
  return invoice;
}

export async function getInvoiceDetail(ctx: WorkspaceContext, id: string) {
  const ws = ctx.workspace.id;
  const invoice = await ctx.db.first("invoices", { eq: { id, workspace_id: ws } });
  if (!invoice) return null;
  const [{ rows: items }, client, project] = await Promise.all([
    ctx.db.select("invoice_items", { eq: { workspace_id: ws, invoice_id: id }, order: [{ column: "position" }] }),
    ctx.db.first("clients", { eq: { id: invoice.client_id, workspace_id: ws } }),
    invoice.project_id ? ctx.db.first("projects", { eq: { id: invoice.project_id, workspace_id: ws } }) : null,
  ]);
  const displayStatus: InvoiceStatus =
    invoice.status === "sent" && invoice.due_date < todayString() ? "overdue" : invoice.status;
  return { invoice: { ...invoice, status: displayStatus }, items, client, project, workspace: ctx.workspace };
}

export type InvoiceDetail = NonNullable<Awaited<ReturnType<typeof getInvoiceDetail>>>;

export async function nextInvoiceNumber(ctx: WorkspaceContext): Promise<string> {
  const { rows } = await ctx.db.select("invoices", { eq: { workspace_id: ctx.workspace.id } });
  const max = rows.reduce((m, inv) => {
    const n = Number.parseInt(inv.number.replace(/\D/g, ""), 10);
    return Number.isFinite(n) ? Math.max(m, n) : m;
  }, 1000);
  return `INV-${max + 1}`;
}

async function validateRefs(ctx: WorkspaceContext, data: Pick<InvoiceData, "clientId" | "projectId">) {
  const client = await ctx.db.first("clients", { eq: { id: data.clientId, workspace_id: ctx.workspace.id } });
  if (!client) throw new UserFacingError("Choose a client from this workspace.");
  if (data.projectId) {
    const project = await ctx.db.first("projects", { eq: { id: data.projectId, workspace_id: ctx.workspace.id } });
    if (!project) throw new UserFacingError("Choose a project from this workspace.");
    if (project.client_id && project.client_id !== data.clientId) {
      throw new UserFacingError("That project belongs to a different client.");
    }
  }
  return client;
}

async function writeItems(ctx: WorkspaceContext, invoiceId: string, data: InvoiceData, lines: number[]) {
  await ctx.db.insertMany(
    "invoice_items",
    data.items.map((item, position) => ({
      workspace_id: ctx.workspace.id,
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      amount: lines[position],
      position,
    })),
  );
}

export async function createInvoice(ctx: WorkspaceContext, data: InvoiceData) {
  await validateRefs(ctx, data);
  const totals = computeTotals(data.items, data.taxRate);
  // Retry once if another invoice grabbed the same number concurrently.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const invoice = await ctx.db.insert("invoices", {
        workspace_id: ctx.workspace.id,
        client_id: data.clientId,
        project_id: data.projectId,
        number: await nextInvoiceNumber(ctx),
        status: "draft",
        issue_date: data.issueDate,
        due_date: data.dueDate,
        subtotal: totals.subtotal,
        tax_rate: data.taxRate,
        tax: totals.tax,
        total: totals.total,
        currency: "USD",
        notes: data.notes,
        sent_at: null,
        paid_at: null,
        created_by: ctx.user.id,
      });
      await writeItems(ctx, invoice.id, data, totals.lines);
      await logActivity(ctx, "invoice.created", { type: "invoice", id: invoice.id, name: invoice.number });
      await touchClient(ctx, data.clientId);
      return invoice;
    } catch (error) {
      if (!(error instanceof DbError && error.code === "unique_violation") || attempt === 2) throw error;
    }
  }
  throw new UserFacingError("We couldn't create the invoice. Please try again.");
}

export async function updateInvoice(ctx: WorkspaceContext, id: string, data: InvoiceData) {
  const existing = await getInvoiceOrThrow(ctx, id);
  if (existing.status === "paid" || existing.status === "cancelled") {
    throw new UserFacingError(`${existing.status === "paid" ? "Paid" : "Cancelled"} invoices can't be edited. Duplicate it to make changes.`);
  }
  await validateRefs(ctx, data);
  const totals = computeTotals(data.items, data.taxRate);
  const [invoice] = await ctx.db.update(
    "invoices",
    { eq: { id, workspace_id: ctx.workspace.id } },
    {
      client_id: data.clientId,
      project_id: data.projectId,
      issue_date: data.issueDate,
      due_date: data.dueDate,
      subtotal: totals.subtotal,
      tax_rate: data.taxRate,
      tax: totals.tax,
      total: totals.total,
      notes: data.notes,
      status: existing.status === "overdue" && data.dueDate >= todayString() ? "sent" : existing.status,
    },
  );
  await ctx.db.remove("invoice_items", { eq: { workspace_id: ctx.workspace.id, invoice_id: id } });
  await writeItems(ctx, id, data, totals.lines);
  await logActivity(ctx, "invoice.updated", { type: "invoice", id, name: invoice.number });
  return invoice;
}

export async function duplicateInvoice(ctx: WorkspaceContext, id: string) {
  const detail = await getInvoiceDetail(ctx, id);
  if (!detail) throw new NotFoundError("That invoice doesn't exist or was deleted.");
  const today = new Date();
  const term = Math.max(
    1,
    Math.round((new Date(detail.invoice.due_date).getTime() - new Date(detail.invoice.issue_date).getTime()) / 86_400_000),
  );
  const copy = await createInvoice(ctx, {
    clientId: detail.invoice.client_id,
    projectId: detail.invoice.project_id,
    issueDate: toDateString(today),
    dueDate: toDateString(addDays(today, term)),
    taxRate: Number(detail.invoice.tax_rate),
    notes: detail.invoice.notes,
    items: detail.items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unit_price) })),
  });
  await logActivity(ctx, "invoice.duplicated", { type: "invoice", id: copy.id, name: copy.number }, { source: detail.invoice.number });
  return copy;
}

export async function markInvoiceSent(ctx: WorkspaceContext, id: string) {
  const existing = await getInvoiceOrThrow(ctx, id);
  if (existing.status !== "draft") throw new UserFacingError("Only draft invoices can be marked as sent.");
  const now = new Date().toISOString();
  const status: InvoiceStatus = existing.due_date < todayString() ? "overdue" : "sent";
  const [invoice] = await ctx.db.update("invoices", { eq: { id, workspace_id: ctx.workspace.id } }, { status, sent_at: now });
  await logActivity(ctx, "invoice.sent", { type: "invoice", id, name: invoice.number });
  await touchClient(ctx, invoice.client_id);
  return invoice;
}

export async function markInvoicePaid(ctx: WorkspaceContext, id: string) {
  const existing = await getInvoiceOrThrow(ctx, id);
  if (existing.status === "paid") return existing;
  if (existing.status === "cancelled") throw new UserFacingError("Cancelled invoices can't be marked as paid.");
  const now = new Date().toISOString();
  const [invoice] = await ctx.db.update(
    "invoices",
    { eq: { id, workspace_id: ctx.workspace.id } },
    { status: "paid", paid_at: now, sent_at: existing.sent_at ?? now },
  );
  await logActivity(ctx, "invoice.paid", { type: "invoice", id, name: invoice.number }, { amount: invoice.total });
  const client = await ctx.db.first("clients", { eq: { id: invoice.client_id, workspace_id: ctx.workspace.id } });
  await notify(
    ctx,
    await adminIds(ctx),
    {
      type: "invoice_paid",
      title: `Invoice ${invoice.number} was paid`,
      body: `${client?.company ?? "A client"} paid ${formatCurrency(Number(invoice.total), invoice.currency, { cents: true })}.`,
      link: `/dashboard/invoices/${id}`,
    },
    "invoices",
  );
  await touchClient(ctx, invoice.client_id);
  return invoice;
}

export async function cancelInvoice(ctx: WorkspaceContext, id: string) {
  const existing = await getInvoiceOrThrow(ctx, id);
  if (existing.status === "paid") throw new UserFacingError("Paid invoices can't be cancelled.");
  const [invoice] = await ctx.db.update("invoices", { eq: { id, workspace_id: ctx.workspace.id } }, { status: "cancelled" });
  await logActivity(ctx, "invoice.cancelled", { type: "invoice", id, name: invoice.number });
  return invoice;
}

export async function deleteDraftInvoice(ctx: WorkspaceContext, id: string) {
  const existing = await getInvoiceOrThrow(ctx, id);
  if (existing.status !== "draft") {
    throw new UserFacingError("Only drafts can be deleted. Cancel sent invoices instead so your records stay complete.");
  }
  await ctx.db.remove("invoices", { eq: { id, workspace_id: ctx.workspace.id, status: "draft" } });
  await logActivity(ctx, "invoice.deleted", { type: "invoice", id: null, name: existing.number });
}
