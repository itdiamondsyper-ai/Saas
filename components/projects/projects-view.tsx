"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarDays, FolderKanban, LayoutGrid, List, Plus } from "lucide-react";
import { AtRiskBadge, PriorityLabel, ProjectStatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { useQueryState } from "@/hooks/use-query-state";
import { PROJECT_STATUSES } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Priority, ProjectStatus } from "@/types/database";
import { ProjectFormDialog, type Option } from "./project-form-dialog";

export interface ProjectCardData {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: Priority;
  progress: number;
  budget: number;
  due_date: string | null;
  start_date: string | null;
  atRisk: boolean;
  openTaskCount: number;
  taskCount: number;
  client: { id: string; company: string } | null;
  owner: { id: string; name: string; avatarUrl: string | null } | null;
  members: { id: string; name: string; avatarUrl: string | null }[];
}

export function ProjectsView({
  projects,
  clients,
  members,
  canWrite,
  openNew,
  defaultClientId,
  currentUserId,
}: {
  projects: ProjectCardData[];
  clients: Option[];
  members: Option[];
  canWrite: boolean;
  openNew: boolean;
  defaultClientId?: string;
  currentUserId: string;
}) {
  const router = useRouter();
  const { params, set, pending } = useQueryState();
  const [formOpen, setFormOpen] = useState(false);
  const view = params.get("view") === "list" ? "list" : "grid";
  const q = params.get("q") ?? "";
  const status = params.get("status") ?? "";
  const client = params.get("client") ?? "";
  const filtered = !!(q || status || client);

  // "?new=1" (from the command menu or quick actions) opens the create dialog once.
  const [handledNew, setHandledNew] = useState(false);
  if (openNew && canWrite && !handledNew) {
    setHandledNew(true);
    setFormOpen(true);
  }
  if (!openNew && handledNew) setHandledNew(false);
  useEffect(() => {
    if (openNew) set({ new: null }, { resetPage: false });
  }, [openNew, set]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Search projects…" label="Search projects" />
        <div className="grid grid-cols-2 gap-2 md:flex">
          <NativeSelect aria-label="Filter by status" value={status} onChange={(e) => set({ status: e.target.value })} className="md:w-40">
            <option value="">All statuses</option>
            {PROJECT_STATUSES.map((s) => (
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
        <div className="flex items-center gap-2 md:ml-auto">
          <div role="group" aria-label="View" className="flex rounded-lg border p-0.5">
            {(
              [
                ["grid", LayoutGrid, "Grid view"],
                ["list", List, "List view"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={view === value}
                onClick={() => set({ view: value === "grid" ? null : value }, { resetPage: false })}
                className={cn("rounded-md p-1.5 text-muted-foreground", view === value && "bg-muted text-foreground")}
              >
                <Icon className="size-4" />
              </button>
            ))}
          </div>
          {canWrite && (
            <Button className="flex-1 md:flex-none" onClick={() => setFormOpen(true)}>
              <Plus /> New project
            </Button>
          )}
        </div>
      </div>

      <div className={cn("transition-opacity", pending && "opacity-60")}>
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title={filtered ? "No projects match your filters" : "No projects yet"}
            description={filtered ? "Try another status or client." : "Create a project to plan work, track budget and invoice clients."}
            action={
              !filtered && canWrite ? (
                <Button onClick={() => setFormOpen(true)}>
                  <Plus /> Create project
                </Button>
              ) : undefined
            }
          />
        ) : view === "grid" ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/dashboard/projects/${p.id}`}
                  className="flex h-full flex-col gap-4 rounded-xl border bg-card p-4 transition-shadow hover:shadow-md focus-visible:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{p.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.client?.company ?? "Internal project"}</p>
                    </div>
                    <PriorityLabel priority={p.priority} iconOnly />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <ProjectStatusBadge status={p.status} />
                    {p.atRisk && <AtRiskBadge />}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progress</span>
                      <span className="tabular">{p.progress}%</span>
                    </div>
                    <Progress value={p.progress} aria-label={`${p.name} progress`} />
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3.5" /> {p.due_date ? formatDate(p.due_date) : "No due date"}
                    </span>
                    <span className="tabular">{formatCurrency(p.budget, "USD", { compact: true })}</span>
                    <span className="flex -space-x-1.5">
                      {p.members.slice(0, 4).map((m) => (
                        <UserAvatar key={m.id} name={m.name} src={m.avatarUrl} size="sm" className="ring-2 ring-card" />
                      ))}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-4 py-2.5 font-medium">Project</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Client</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Owner</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Priority</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Progress</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Due</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Budget</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {projects.map((p) => (
                  <tr key={p.id} className="cursor-pointer hover:bg-muted/30" onClick={() => router.push(`/dashboard/projects/${p.id}`)}>
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/projects/${p.id}`} className="font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
                        {p.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.client?.company ?? "—"}</td>
                    <td className="px-4 py-3">
                      {p.owner ? (
                        <span className="flex items-center gap-2">
                          <UserAvatar name={p.owner.name} src={p.owner.avatarUrl} size="sm" />
                          <span className="truncate">{p.owner.name}</span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex gap-1.5">
                        <ProjectStatusBadge status={p.status} />
                        {p.atRisk && <AtRiskBadge />}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityLabel priority={p.priority} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <Progress value={p.progress} className="w-20" aria-label={`${p.name} progress`} />
                        <span className="text-xs tabular">{p.progress}%</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(p.due_date)}</td>
                    <td className="px-4 py-3 text-right tabular">{formatCurrency(p.budget)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        clients={clients}
        members={members}
        defaultClientId={defaultClientId}
        currentUserId={currentUserId}
        onSaved={(id) => router.push(`/dashboard/projects/${id}`)}
      />
    </div>
  );
}
