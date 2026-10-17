import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { BreadcrumbLabel } from "@/components/app/app-context";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { clientOptions } from "@/lib/services/clients";
import { getInvoiceDetail } from "@/lib/services/invoices";
import { projectOptions } from "@/lib/services/projects";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Edit invoice" };

export default async function EditInvoicePage({ params }: PageProps<"/dashboard/invoices/[id]/edit">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const ctx = await requireWorkspace();
  const detail = await getInvoiceDetail(ctx, id);
  if (!detail) notFound();
  const { invoice, items } = detail;
  if (!can(ctx.role, "records:write") || invoice.status === "paid" || invoice.status === "cancelled") {
    redirect(`/dashboard/invoices/${id}`);
  }
  const [clients, projects] = await Promise.all([clientOptions(ctx), projectOptions(ctx)]);
  if (detail.client && !clients.some((c) => c.id === detail.client!.id)) clients.unshift({ id: detail.client.id, label: detail.client.company });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BreadcrumbLabel label={invoice.number} />
      <PageHeader title={`Edit ${invoice.number}`} description="Changes update the invoice totals immediately." />
      <InvoiceBuilder
        invoiceId={invoice.id}
        number={invoice.number}
        clients={clients}
        projects={projects.map((p) => ({ id: p.id, label: p.label, clientId: p.clientId }))}
        initial={{
          clientId: invoice.client_id,
          projectId: invoice.project_id ?? "",
          issueDate: invoice.issue_date,
          dueDate: invoice.due_date,
          taxRate: Number(invoice.tax_rate),
          notes: invoice.notes ?? "",
          items: items.map((i) => ({ description: i.description, quantity: Number(i.quantity), unitPrice: Number(i.unit_price) })),
        }}
      />
    </div>
  );
}
