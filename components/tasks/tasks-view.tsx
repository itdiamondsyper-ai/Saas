"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckSquare, Columns3, Plus, Table2 } from "lucide-react";
import type { Option } from "@/components/projects/project-form-dialog";
import { PriorityLabel, TaskStatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { SearchInput } from "@/components/shared/search-input";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { useAction } from "@/hooks/use-action";
import { useQueryState } from "@/hooks/use-query-state";
import { setTaskStatusAction } from "@/lib/actions/records";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/database";
import { KanbanBoard } from "./kanban-board";
import { DueDate, type BoardTask } from "./task-card";
import { TaskDrawer } from "./task-drawer";
import { TaskFormDialog, type TaskFormDefaults } from "./task-form-dialog";

export function TasksView({
  tasks,
  projects,
  members,
  labels,
  canWrite,
  canDelete,
  currentUserId,
  openNew,
}: {
  tasks: BoardTask[];
  projects: Option[];
  members: Option[];
  labels: string[];
  canWrite: boolean;
  canDelete: boolean;
  currentUserId: string;
  openNew: boolean;
}) {
  const router = useRouter();
  const { params, set, pending } = useQueryState();
  const { run } = useAction();
  const [formOpen, setFormOpen] = useState(false);
  const [defaults, setDefaults] = useState<TaskFormDefaults>({});
  const view = params.get("view") === "table" ? "table" : "board";
  const openTaskId = params.get("task");
  const filters = ["q", "project", "assignee", "priority", "label", "due"] as const;
  const filtered = filters.some((f) => params.get(f));

  // "?new=1" (from the command menu or quick actions) opens the create dialog once.
  const [handledNew, setHandledNew] = useState(false);
  if (openNew && canWrite && !handledNew) {
    setHandledNew(true);
      setDefaults({});
    setFormOpen(true);
  }
  if (!openNew && handledNew) setHandledNew(false);
  useEffect(() => {
    if (openNew) set({ new: null }, { resetPage: false });
  }, [openNew, set]);

  const openTask = (id: string) => set({ task: id }, { resetPage: false });
  const add = (status?: TaskStatus) => {
    setDefaults({ status, projectId: params.get("project") });
    setFormOpen(true);
  };

  const toggleDone = async (t: BoardTask) => {
    const status = t.status === "done" ? "todo" : "done";
    const r = await run(() => setTaskStatusAction({ id: t.id, status }), { success: status === "done" ? "Task completed" : "Task reopened" });
    if (r.ok) router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
        <SearchInput value={params.get("q") ?? ""} onChange={(v) => set({ q: v })} placeholder="Search tasks…" label="Search tasks" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex">
          <NativeSelect aria-label="Filter by project" value={params.get("project") ?? ""} onChange={(e) => set({ project: e.target.value })} className="xl:w-44">
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Filter by assignee" value={params.get("assignee") ?? ""} onChange={(e) => set({ assignee: e.target.value })} className="xl:w-40">
            <option value="">Everyone</option>
            <option value={currentUserId}>Assigned to me</option>
            {members
              .filter((m) => m.id !== currentUserId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            <option value="unassigned">Unassigned</option>
          </NativeSelect>
          <NativeSelect aria-label="Filter by priority" value={params.get("priority") ?? ""} onChange={(e) => set({ priority: e.target.value })} className="xl:w-36">
            <option value="">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Filter by due date or label" value={params.get("due") ? `due:${params.get("due")}` : params.get("label") ? `label:${params.get("label")}` : ""} onChange={(e) => {
            const [kind, value] = e.target.value.split(":");
            set({ due: kind === "due" ? value : null, label: kind === "label" ? value : null });
          }} className="xl:w-40">
            <option value="">Any due date</option>
            <option value="due:overdue">Overdue</option>
            <option value="due:week">Due this week</option>
            {labels.length > 0 && (
              <optgroup label="Labels">
                {labels.map((l) => (
                  <option key={l} value={`label:${l}`}>
                    {l}
                  </option>
                ))}
              </optgroup>
            )}
          </NativeSelect>
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => set(Object.fromEntries(filters.map((f) => [f, null])))}>
            Clear filters
          </Button>
        )}
        <div className="flex items-center gap-2 xl:ml-auto">
          <div role="group" aria-label="View" className="flex rounded-lg border p-0.5">
            {(
              [
                ["board", Columns3, "Kanban view"],
                ["table", Table2, "Table view"],
              ] as const
            ).map(([value, Icon, label]) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={view === value}
                onClick={() => set({ view: value === "board" ? null : value }, { resetPage: false })}
                className={cn("flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-muted-foreground", view === value && "bg-muted text-foreground")}
              >
                <Icon className="size-4" /> <span className="max-sm:sr-only">{value === "board" ? "Board" : "Table"}</span>
              </button>
            ))}
          </div>
          {canWrite && (
            <Button className="flex-1 xl:flex-none" onClick={() => add()}>
              <Plus /> New task
            </Button>
          )}
        </div>
      </div>

      <div className={cn("transition-opacity", pending && "opacity-60")}>
        {tasks.length === 0 && (filtered || view === "table") ? (
          <EmptyState
            icon={CheckSquare}
            title={filtered ? "No tasks match your filters" : "No tasks yet"}
            description={filtered ? "Try adjusting the filters." : "Break your projects into tasks and assign them to your team."}
            action={!filtered && canWrite ? <Button onClick={() => add()}><Plus /> Create task</Button> : undefined}
          />
        ) : view === "board" ? (
          <KanbanBoard tasks={tasks} onOpen={openTask} onAdd={add} canWrite={canWrite} />
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="w-10 px-4 py-2.5"><span className="sr-only">Done</span></th>
                  <th scope="col" className="px-2 py-2.5 font-medium">Task</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Project</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Assignee</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Status</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Priority</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {TASK_STATUSES.flatMap((s) => tasks.filter((t) => t.status === s.value)).map((t) => (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <Checkbox checked={t.status === "done"} disabled={!canWrite} onCheckedChange={() => toggleDone(t)} aria-label={t.status === "done" ? `Reopen ${t.title}` : `Complete ${t.title}`} />
                    </td>
                    <td className="px-2 py-2.5">
                      <button type="button" onClick={() => openTask(t.id)} className={cn("text-left font-medium hover:underline", t.status === "done" && "text-muted-foreground line-through")}>
                        {t.title}
                      </button>
                      {t.labels.length > 0 && <span className="ml-2 text-xs text-muted-foreground">{t.labels.join(", ")}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{t.project?.name ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {t.assignee ? (
                        <span className="flex items-center gap-2">
                          <UserAvatar name={t.assignee.name} src={t.assignee.avatarUrl} size="sm" /> <span className="truncate">{t.assignee.name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5"><TaskStatusBadge status={t.status} /></td>
                    <td className="px-4 py-2.5"><PriorityLabel priority={t.priority} /></td>
                    <td className="px-4 py-2.5"><DueDate date={t.due_date} done={t.status === "done"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} defaults={defaults} projects={projects} members={members} />
      <TaskDrawer
        taskId={openTaskId}
        onClose={() => set({ task: null }, { resetPage: false })}
        projects={projects}
        members={members}
        canWrite={canWrite}
        canDelete={canDelete}
        currentUserId={currentUserId}
      />
    </div>
  );
}
