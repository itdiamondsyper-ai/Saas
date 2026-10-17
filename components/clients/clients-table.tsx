"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Archive, ArchiveRestore, ArrowDown, ArrowUp, ArrowUpDown, Eye, MoreHorizontal, Pencil, Plus, Trash2, Users } from "lucide-react";
import { ClientStatusBadge } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { SearchInput } from "@/components/shared/search-input";
import { CompanyAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/hooks/use-action";
import { useQueryState } from "@/hooks/use-query-state";
import { deleteClientAction, setClientStatusAction } from "@/lib/actions/records";
import { CLIENT_STATUSES } from "@/lib/constants";
import { formatCurrency, formatRelative } from "@/lib/format";
import type { ClientListItem, ClientSort } from "@/lib/services/clients";
import { cn } from "@/lib/utils";
import { ClientFormDialog } from "./client-form-dialog";

const COLUMNS: { key: ClientSort | null; label: string; className?: string }[] = [
  { key: "contact_name", label: "Name" },
  { key: "company", label: "Company" },
  { key: null, label: "Email", className: "max-lg:hidden" },
  { key: "status", label: "Status" },
  { key: "revenue", label: "Total revenue", className: "text-right" },
  { key: "projects", label: "Active projects", className: "text-right max-xl:hidden" },
  { key: "last_activity_at", label: "Last activity", className: "max-lg:hidden" },
];

export function ClientsTable({
  rows,
  total,
  page,
  pageSize,
  totalPages,
  canWrite,
  canDelete,
  openNew,
}: {
  rows: ClientListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  canWrite: boolean;
  canDelete: boolean;
  openNew: boolean;
}) {
  const router = useRouter();
  const { params, set, pending } = useQueryState();
  const { run } = useAction();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ClientListItem | null>(null);
  const [deleting, setDeleting] = useState<ClientListItem | null>(null);

  // "?new=1" (from the command menu or quick actions) opens the create dialog once.
  const [handledNew, setHandledNew] = useState(false);
  if (openNew && canWrite && !handledNew) {
    setHandledNew(true);
      setEditing(null);
    setFormOpen(true);
  }
  if (!openNew && handledNew) setHandledNew(false);
  useEffect(() => {
    if (openNew) set({ new: null }, { resetPage: false });
  }, [openNew, set]);

  const sort = (params.get("sort") as ClientSort) ?? "company";
  const dir = params.get("dir") === "desc" ? "desc" : "asc";
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const filtered = !!q || !!status;

  const toggleSort = (key: ClientSort) =>
    set({ sort: key, dir: sort === key && dir === "asc" ? "desc" : key === "revenue" || key === "last_activity_at" ? "desc" : "asc" });

  const actions = (c: ClientListItem) => (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.company}`} />}>
        <MoreHorizontal />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem render={<Link href={`/dashboard/clients/${c.id}`} />}>
          <Eye /> View details
        </DropdownMenuItem>
        {canWrite && (
          <>
            <DropdownMenuItem
              onClick={() => {
                setEditing(c);
                setFormOpen(true);
              }}
            >
              <Pencil /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                const next = c.status === "archived" ? "active" : "archived";
                const r = await run(() => setClientStatusAction({ id: c.id, status: next }), {
                  success: next === "archived" ? `${c.company} archived` : `${c.company} restored`,
                });
                if (r.ok) router.refresh();
              }}
            >
              {c.status === "archived" ? <ArchiveRestore /> : <Archive />} {c.status === "archived" ? "Restore" : "Archive"}
            </DropdownMenuItem>
          </>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={() => setDeleting(c)}>
              <Trash2 /> Delete
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Search clients…" label="Search clients" />
        <NativeSelect aria-label="Filter by status" value={status} onChange={(e) => set({ status: e.target.value })} className="sm:w-44">
          <option value="">All except archived</option>
          {CLIENT_STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
          <option value="all">All statuses</option>
        </NativeSelect>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => set({ q: null, status: null })}>
            Clear filters
          </Button>
        )}
        {canWrite && (
          <Button
            className="sm:ml-auto"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus /> New client
          </Button>
        )}
      </div>

      <div className={cn("overflow-hidden rounded-xl border bg-card transition-opacity", pending && "opacity-60")}>
        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            className="m-4 border-0"
            title={filtered ? "No clients match your filters" : "No clients yet"}
            description={filtered ? "Try a different search or status." : "Add your first client to start tracking projects and revenue."}
            action={
              !filtered && canWrite ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus /> Add client
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.label}
                        scope="col"
                        className={cn("px-4 py-2.5 font-medium", col.className)}
                        aria-sort={col.key && sort === col.key ? (dir === "asc" ? "ascending" : "descending") : undefined}
                      >
                        {col.key ? (
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key!)}
                            className={cn("inline-flex items-center gap-1 hover:text-foreground", col.className?.includes("text-right") && "flex-row-reverse")}
                          >
                            {col.label}
                            {sort === col.key ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 opacity-50" />}
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                    <th scope="col" className="w-12 px-2">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((c) => (
                    <tr key={c.id} className="group hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/clients/${c.id}`} className="font-medium hover:underline">
                          {c.contact_name || "—"}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2.5">
                          <CompanyAvatar name={c.company} className="size-7" />
                          <span className="truncate">{c.company}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-lg:hidden">{c.email ?? "—"}</td>
                      <td className="px-4 py-3">
                        <ClientStatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-right font-medium tabular">{formatCurrency(c.totalRevenue)}</td>
                      <td className="px-4 py-3 text-right tabular max-xl:hidden">{c.activeProjects}</td>
                      <td className="px-4 py-3 text-muted-foreground max-lg:hidden">{formatRelative(c.last_activity_at)}</td>
                      <td className="px-2 py-3">{actions(c)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y md:hidden">
              {rows.map((c) => (
                <li key={c.id} className="flex items-center gap-3 p-4">
                  <CompanyAvatar name={c.company} />
                  <Link href={`/dashboard/clients/${c.id}`} className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.company}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.contact_name} · {formatCurrency(c.totalRevenue)}
                    </span>
                  </Link>
                  <ClientStatusBadge status={c.status} />
                  {actions(c)}
                </li>
              ))}
            </ul>
            <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} noun="clients" onPage={(p) => set({ page: String(p) }, { resetPage: false })} />
          </>
        )}
      </div>

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editing}
        onSaved={(id) => {
          if (!editing) router.push(`/dashboard/clients/${id}`);
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.company ?? "client"}?`}
        description="This permanently deletes the client, its files and unlinks its projects. Clients with invoices can't be deleted; archive them instead."
        confirmLabel="Delete client"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const r = await run(() => deleteClientAction({ id: deleting.id }), { success: `${deleting.company} deleted` });
          if (r.ok) router.refresh();
          return r.ok;
        }}
      />
    </div>
  );
}
