import { LogoMark } from "@/components/shared/logo";
import { InvoiceStatusBadge } from "@/components/shared/badges";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceDetail } from "@/lib/services/invoices";

/** The invoice as the client sees it. Also used for printing. */
export function InvoiceDocument({ detail }: { detail: InvoiceDetail }) {
  const { invoice, items, client, project, workspace } = detail;
  const money = (n: number) => formatCurrency(Number(n), invoice.currency, { cents: true });
  return (
    <article className="print-surface rounded-xl border bg-card p-6 text-card-foreground shadow-xs sm:p-10" aria-label={`Invoice ${invoice.number}`}>
      <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3">
          {workspace.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo
            <img src={workspace.logo_url} alt="" className="size-10 rounded-lg object-cover" />
          ) : (
            <LogoMark className="size-10" />
          )}
          <div>
            <p className="text-lg font-semibold">{workspace.name}</p>
            {workspace.industry && <p className="text-sm text-muted-foreground">{workspace.industry}</p>}
          </div>
        </div>
        <div className="sm:text-right">
          <p className="text-2xl font-semibold tracking-tight">Invoice</p>
          <p className="text-sm text-muted-foreground tabular">{invoice.number}</p>
          <div className="mt-2 sm:flex sm:justify-end">
            <InvoiceStatusBadge status={invoice.status} />
          </div>
        </div>
      </header>

      <div className="mt-10 grid gap-6 text-sm sm:grid-cols-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Billed to</p>
          <p className="mt-1.5 font-medium">{client?.company ?? "Unknown client"}</p>
          {client?.contact_name && <p>{client.contact_name}</p>}
          {client?.email && <p className="text-muted-foreground">{client.email}</p>}
          {client?.address && <p className="text-muted-foreground">{client.address}</p>}
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Dates</p>
          <p className="mt-1.5">Issued {formatDate(invoice.issue_date, "long")}</p>
          <p>Due {formatDate(invoice.due_date, "long")}</p>
          {invoice.paid_at && <p className="text-success">Paid {formatDate(invoice.paid_at, "long")}</p>}
        </div>
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Amount due</p>
          <p className="mt-1.5 text-2xl font-semibold tabular">{invoice.status === "paid" ? money(0) : money(invoice.total)}</p>
          {project && <p className="text-muted-foreground">Project: {project.name}</p>}
        </div>
      </div>

      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[480px] text-sm">
          <thead className="border-b text-left text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">Description</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Qty</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Rate</th>
              <th scope="col" className="py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="py-3 pr-4">{item.description}</td>
                <td className="py-3 pr-4 text-right tabular">{Number(item.quantity)}</td>
                <td className="py-3 pr-4 text-right tabular">{money(item.unit_price)}</td>
                <td className="py-3 text-right font-medium tabular">{money(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className="mt-6 ml-auto grid max-w-xs gap-2 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Subtotal</dt>
          <dd className="tabular">{money(invoice.subtotal)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted-foreground">Tax ({Number(invoice.tax_rate)}%)</dt>
          <dd className="tabular">{money(invoice.tax)}</dd>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-semibold">
          <dt>Total</dt>
          <dd className="tabular">{money(invoice.total)}</dd>
        </div>
      </dl>

      {invoice.notes && (
        <footer className="mt-10 border-t pt-6">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Notes</p>
          <p className="mt-1.5 text-sm whitespace-pre-wrap text-muted-foreground">{invoice.notes}</p>
        </footer>
      )}
    </article>
  );
}
