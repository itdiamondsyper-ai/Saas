"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Ban, CheckCircle2, Copy, Download, Loader2, MoreHorizontal, Pencil, Printer, Send, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action";
import {
  cancelInvoiceAction,
  deleteInvoiceAction,
  duplicateInvoiceAction,
  markInvoicePaidAction,
  markInvoiceSentAction,
} from "@/lib/actions/records";
import type { InvoiceStatus } from "@/types/database";

export function InvoiceActions({
  id,
  number,
  status,
  canWrite,
  canDeleteDraft,
}: {
  id: string;
  number: string;
  status: InvoiceStatus;
  canWrite: boolean;
  canDeleteDraft: boolean;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [confirm, setConfirm] = useState<"delete" | "cancel" | null>(null);
  const editable = status !== "paid" && status !== "cancelled";

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      {canWrite && status === "draft" && (
        <Button
          disabled={pending}
          onClick={async () => {
            const r = await run(() => markInvoiceSentAction({ id }), { success: `${number} marked as sent` });
            if (r.ok) router.refresh();
          }}
        >
          {pending ? <Loader2 className="animate-spin" /> : <Send />} Mark as sent
        </Button>
      )}
      {canWrite && (status === "sent" || status === "overdue") && (
        <Button
          disabled={pending}
          onClick={async () => {
            const r = await run(() => markInvoicePaidAction({ id }), { success: `${number} marked as paid` });
            if (r.ok) router.refresh();
          }}
        >
          {pending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Mark as paid
        </Button>
      )}
      <a href={`/api/invoices/${id}/pdf`} className={buttonVariants({ variant: "outline" })}>
        <Download /> Download PDF
      </a>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More invoice actions" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {canWrite && editable && (
            <DropdownMenuItem render={<Link href={`/dashboard/invoices/${id}/edit`} />}>
              <Pencil /> Edit
            </DropdownMenuItem>
          )}
          {canWrite && (
            <DropdownMenuItem
              onClick={async () => {
                const r = await run(() => duplicateInvoiceAction({ id }));
                if (r.ok) {
                  router.push(`/dashboard/invoices/${r.data.id}`);
                  router.refresh();
                }
              }}
            >
              <Copy /> Duplicate
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => window.print()}>
            <Printer /> Print
          </DropdownMenuItem>
          {canWrite && editable && status !== "draft" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirm("cancel")}>
                <Ban /> Cancel invoice
              </DropdownMenuItem>
            </>
          )}
          {canDeleteDraft && status === "draft" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setConfirm("delete")}>
                <Trash2 /> Delete draft
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Delete draft ${number}?`}
        description="This draft and its line items will be permanently deleted."
        confirmLabel="Delete draft"
        destructive
        onConfirm={async () => {
          const r = await run(() => deleteInvoiceAction({ id }), { success: "Draft deleted" });
          if (r.ok) router.push("/dashboard/invoices");
          return r.ok;
        }}
      />
      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Cancel ${number}?`}
        description="The invoice stays in your records as cancelled and no longer counts as outstanding."
        confirmLabel="Cancel invoice"
        destructive
        onConfirm={async () => {
          const r = await run(() => cancelInvoiceAction({ id }), { success: `${number} cancelled` });
          if (r.ok) router.refresh();
          return r.ok;
        }}
      />
    </div>
  );
}
