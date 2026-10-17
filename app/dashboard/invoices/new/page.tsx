import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { buttonVariants } from "@/components/ui/button";
import { addDays, toDateString } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { clientOptions } from "@/lib/services/clients";
import { nextInvoiceNumber } from "@/lib/services/invoices";
import { projectOptions } from "@/lib/services/projects";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "New invoice" };

export default async function NewInvoicePage({ searchParams }: PageProps<"/dashboard/invoices/new">) {
  const ctx = await requireWorkspace();
  if (!can(ctx.role, "records:write")) redirect("/dashboard/invoices");
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" && uuid.safeParse(sp[k]).success ? (sp[k] as string) : "");
  const [clients, projects, number] = await Promise.all([clientOptions(ctx), projectOptions(ctx), nextInvoiceNumber(ctx)]);
  const today = new Date();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="New invoice" description="Build an itemized invoice. It's saved as a draft until you mark it as sent." />
      {clients.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Add a client first"
          description="Invoices are always billed to a client."
          action={
            <Link href="/dashboard/clients?new=1" className={buttonVariants()}>
              Add client
            </Link>
          }
        />
      ) : (
        <InvoiceBuilder
          number={number}
          clients={clients}
          projects={projects.map((p) => ({ id: p.id, label: p.label, clientId: p.clientId }))}
          initial={{
            clientId: pick("client"),
            projectId: pick("project"),
            issueDate: toDateString(today),
            dueDate: toDateString(addDays(today, 30)),
            taxRate: 9,
            notes: "Thank you for your business. Payment is due within 30 days.",
            items: [{ description: "", quantity: 1, unitPrice: 0 }],
          }}
        />
      )}
    </div>
  );
}
