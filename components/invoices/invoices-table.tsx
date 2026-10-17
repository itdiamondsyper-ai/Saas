"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CheckCircle2, Copy, Eye, FileText, MoreHorizontal, Pencil, Plus, Send, Trash2 } from "lucide-react";
import { InvoiceStatusBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/hooks/use-action";
import { useQueryState } from "@/hooks/use-query-state";
import { deleteInvoiceAction, duplicateInvoiceAction, markInvoicePaidAction, markInvoiceSentAction } from "@/lib/actions/records";
import { INVOICE_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/types/database";

export interface InvoiceRowData {
  id: string;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  total: number;
  client: string;
}

export function InvoicesTable({
  rows,
  clients,
  canWrite,
  canDeleteDraft,
}: {
  rows: InvoiceRowData[];
  clients: { id: string; label: string }[];
  canWrite: boolean;
  canDeleteDraft: boolean;
}) {
  const router = useRouter();
  const { params, set, pending } = useQueryState();
  const { run } = useAction();
  const [deleting, setDeleting] = useState<InvoiceRowData | null>(null);
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const client = params.get("client") ?? "";
  const filtered = !!(q || status || client);

  const act = async (fn: () => ReturnType<typeof markInvoiceSentAction>, message: string) => {
    const r = await run(fn, { success: message });
    if (r.ok) router.refresh();
  };

  const menu = (inv: InvoiceRowData) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${inv.number}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem render={<Link href={`/dashboard/invoices/${inv.id}`} />}>
          <Eye /> View
        </DropdownMenuItem>
        {canWrite && inv.status !== "paid" && inv.status !== "cancelled" && (
          <DropdownMenuItem render={<Link href={`/dashboard/invoices/${inv.id}/edit`} />}>
            <Pencil /> Edit
          </DropdownMenuItem>
        )}
        {canWrite && (
          <DropdownMenuItem
            onClick={async () => {
              const r = await run(() => duplicateInvoiceAction({ id: inv.id }), { success: `Duplicated ${inv.number}` });
              if (r.ok) router.push(`/dashboard/invoices/${r.data.id}`);
            }}
          >
            <Copy /> Duplicate
          </DropdownMenuItem>
        )}
        {canWrite && inv.status === "draft" && (
          <DropdownMenuItem onClick={() => act(() => markInvoiceSentAction({ id: inv.id }), `${inv.number} marked as sent`)}>
            <Send /> Mark as sent
          </DropdownMenuItem>
        )}
        {canWrite && (inv.status === "sent" || inv.status === "overdue") && (
          <DropdownMenuItem onClick={() => act(() => markInvoicePaidAction({ id: inv.id }), `${inv.number} marked as paid`)}>
            <CheckCircle2 /> Mark as paid
          </DropdownMenuItem>
        )}
        {canDeleteDraft && inv.status === "draft" && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(inv)}>
              <Trash2 /> Delete draft
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Search by number or client…" label="Search invoices" />
        <div className="grid grid-cols-2 gap-2 md:flex">
          <NativeSelect aria-label="Filter by status" value={status} onChange={(e) => set({ status: e.target.value })} className="md:w-40">
            <option value="">All statuses</option>
            <option value="outstanding">Outstanding</option>
            {INVOICE_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Filter by client" value={client} onChange={(e) => set({ client: e.target.value })} className="md:w-48">
            <option value="">All clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => set({ q: null, status: null, client: null })}>
            Clear filters
          </Button>
        )}
        {canWrite && (
          <Link href="/dashboard/invoices/new" className={cn(buttonVariants(), "md:ml-auto")}>
            <Plus /> New invoice
          </Link>
        )}
      </div>

      <div className={cn("overflow-hidden rounded-xl border bg-card transition-opacity", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <EmptyState
            icon={FileText}
            className="m-4 border-0"
            title={filtered ? "No invoices match your filters" : "No invoices yet"}
            description={filtered ? "Try a different status or client." : "Create your first invoice and get paid faster."}
            action={
              !filtered && canWrite ? (
                <Link href="/dashboard/invoices/new" className={buttonVariants()}>
                  <Plus /> New invoice
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 font-medium">Invoice</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Client</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Issued</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Due</th>
                    <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Total</th>
                    <th scope="col" className="w-12"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/invoices/${inv.id}`} className="font-medium tabular hover:underline">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{inv.client}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(inv.issue_date)}</td>
                      <td className={cn("px-4 py-3", inv.status === "overdue" ? "text-destructive" : "text-muted-foreground")}>{formatDate(inv.due_date)}</td>
                      <td className="px-4 py-3"><InvoiceStatusBadge status={inv.status} /></td>
                      <td className="px-4 py-3 text-right font-medium tabular">{formatCurrency(inv.total, "USD", { cents: true })}</td>
                      <td className="px-2 py-3">{menu(inv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y md:hidden">
              {rows.map((inv) => (
                <li key={inv.id} className="flex items-center gap-3 p-4">
                  <Link href={`/dashboard/invoices/${inv.id}`} className="min-w-0 flex-1">
                    <span className="block font-medium">{inv.client}</span>
                    <span className="block text-xs text-muted-foreground">
                      {inv.number} · due {formatDate(inv.due_date)}
                    </span>
                  </Link>
                  <span className="text-right">
                    <span className="block text-sm font-medium tabular">{formatCurrency(inv.total, "USD", { cents: true })}</span>
                    <InvoiceStatusBadge status={inv.status} />
                  </span>
                  {menu(inv)}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete draft ${deleting?.number ?? ""}?`}
        description="This draft and its line items will be permanently deleted."
        confirmLabel="Delete draft"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const r = await run(() => deleteInvoiceAction({ id: deleting.id }), { success: "Draft deleted" });
          if (r.ok) router.refresh();
          return r.ok;
        }}
      />
    </div>
  );
}
