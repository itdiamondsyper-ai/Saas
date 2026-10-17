import type { Metadata } from "next";
import { InvoicesTable } from "@/components/invoices/invoices-table";
import { PageHeader } from "@/components/shared/page-header";
import { formatCurrency } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { clientOptions } from "@/lib/services/clients";
import { listInvoices, type InvoiceQuery } from "@/lib/services/invoices";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Invoices" };

const STATUSES = ["draft", "sent", "paid", "overdue", "cancelled", "outstanding"];

export default async function InvoicesPage({ searchParams }: PageProps<"/dashboard/invoices">) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const status = STATUSES.includes(str("status") ?? "") ? (str("status") as InvoiceQuery["status"]) : undefined;
  const clientId = uuid.safeParse(str("client")).success ? str("client") : undefined;
  const [rows, all, clients] = await Promise.all([
    listInvoices(ctx, { q: str("q"), status, clientId }),
    listInvoices(ctx),
    clientOptions(ctx),
  ]);

  const sum = (s: string[]) => all.filter((i) => s.includes(i.status)).reduce((acc, i) => acc + Number(i.total), 0);
  const count = (s: string[]) => all.filter((i) => s.includes(i.status)).length;
  const summary = [
    { label: "Outstanding", value: sum(["sent", "overdue"]), count: count(["sent", "overdue"]) },
    { label: "Overdue", value: sum(["overdue"]), count: count(["overdue"]), danger: true },
    { label: "Drafts", value: sum(["draft"]), count: count(["draft"]) },
    { label: "Paid (all time)", value: sum(["paid"]), count: count(["paid"]) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Invoices" description="Bill clients, track payments and follow up on what's overdue." />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className={`mt-1 text-xl font-semibold tracking-tight tabular ${s.danger && s.value > 0 ? "text-destructive" : ""}`}>
              {formatCurrency(s.value, "USD", { cents: true })}
            </p>
            <p className="text-xs text-muted-foreground">
              {s.count} invoice{s.count === 1 ? "" : "s"}
            </p>
          </div>
        ))}
      </div>
      <InvoicesTable
        rows={rows.map((i) => ({
          id: i.id,
          number: i.number,
          status: i.status,
          issue_date: i.issue_date,
          due_date: i.due_date,
          total: Number(i.total),
          client: i.client?.company ?? "Unknown client",
        }))}
        clients={clients}
        canWrite={can(ctx.role, "records:write")}
        canDeleteDraft={can(ctx.role, "invoices:delete_draft")}
      />
    </div>
  );
}
