import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BreadcrumbLabel } from "@/components/app/app-context";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { formatDateTime } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { getInvoiceDetail } from "@/lib/services/invoices";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage({ params }: PageProps<"/dashboard/invoices/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const ctx = await requireWorkspace();
  const detail = await getInvoiceDetail(ctx, id);
  if (!detail) notFound();
  const { invoice } = detail;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <BreadcrumbLabel label={invoice.number} />
      <div className="no-print flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/dashboard/invoices" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" /> All invoices
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            Created {formatDateTime(invoice.created_at)}
            {invoice.sent_at ? ` · sent ${formatDateTime(invoice.sent_at)}` : ""}
          </p>
        </div>
        <InvoiceActions
          id={invoice.id}
          number={invoice.number}
          status={invoice.status}
          canWrite={can(ctx.role, "records:write")}
          canDeleteDraft={can(ctx.role, "invoices:delete_draft")}
        />
      </div>
      <InvoiceDocument detail={detail} />
    </div>
  );
}
