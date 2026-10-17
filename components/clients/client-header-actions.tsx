"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action";
import { deleteClientAction, setClientStatusAction } from "@/lib/actions/records";
import type { ClientRow } from "@/types/database";
import { ClientFormDialog } from "./client-form-dialog";

export function ClientHeaderActions({ client, canWrite, canDelete }: { client: ClientRow; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const { run } = useAction();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const archived = client.status === "archived";
  if (!canWrite) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil /> Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More actions" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onClick={async () => {
              const r = await run(() => setClientStatusAction({ id: client.id, status: archived ? "active" : "archived" }), {
                success: archived ? "Client restored" : "Client archived",
              });
              if (r.ok) router.refresh();
            }}
          >
            {archived ? <ArchiveRestore /> : <Archive />} {archived ? "Restore client" : "Archive client"}
          </DropdownMenuItem>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> Delete client
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ClientFormDialog open={editOpen} onOpenChange={setEditOpen} client={client} />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${client.company}?`}
        description="This permanently deletes the client and its files. Projects stay but are unlinked. Clients with invoices can't be deleted; archive them instead."
        confirmLabel="Delete client"
        destructive
        onConfirm={async () => {
          const r = await run(() => deleteClientAction({ id: client.id }), { success: `${client.company} deleted` });
          if (r.ok) router.push("/dashboard/clients");
          return r.ok;
        }}
      />
    </>
  );
}
