"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CheckSquare, Loader2, MoreHorizontal, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { PriorityLabel } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormField, fieldA11y } from "@/components/shared/form-field";
import { UserAvatar } from "@/components/shared/user-avatar";
import { DueDate, type BoardTask } from "@/components/tasks/task-card";
import { TaskDrawer } from "@/components/tasks/task-drawer";
import { TaskFormDialog } from "@/components/tasks/task-form-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAction } from "@/hooks/use-action";
import { addExpenseAction, deleteExpenseAction, deleteProjectAction, setProjectStatusAction, setTaskStatusAction } from "@/lib/actions/records";
import { PROJECT_STATUSES, TASK_STATUSES, lookup } from "@/lib/constants";
import { todayString } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { expenseSchema } from "@/lib/validation/schemas";
import type { ExpenseRow, ProjectRow } from "@/types/database";
import { ProjectFormDialog, type Option } from "./project-form-dialog";

export function ProjectTabs({ panels }: { panels: { value: string; label: string; content: React.ReactNode }[] }) {
  return (
    <Tabs defaultValue={panels[0].value} className="gap-4">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList variant="line" className="w-max">
          {panels.map((p) => (
            <TabsTrigger key={p.value} value={p.value} className="px-3">
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>
      {panels.map((p) => (
        <TabsContent key={p.value} value={p.value}>
          {p.content}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function ProjectHeaderActions({
  project,
  memberIds,
  clients,
  members,
  hasTasks,
  canWrite,
  canDelete,
  currentUserId,
}: {
  project: ProjectRow;
  memberIds: string[];
  clients: Option[];
  members: Option[];
  hasTasks: boolean;
  canWrite: boolean;
  canDelete: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const { run } = useAction();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  if (!canWrite) return null;
  return (
    <>
      <Button variant="outline" onClick={() => setEditOpen(true)}>
        <Pencil /> Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button variant="outline" size="icon" aria-label="More project actions" />}>
          <MoreHorizontal />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Move to</DropdownMenuLabel>
            {PROJECT_STATUSES.filter((s) => s.value !== project.status).map((s) => (
              <DropdownMenuItem
                key={s.value}
                onClick={async () => {
                  const r = await run(() => setProjectStatusAction({ id: project.id, status: s.value }), { success: `Moved to ${s.label}` });
                  if (r.ok) router.refresh();
                }}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 /> Delete project
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      <ProjectFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        project={project}
        memberIds={memberIds}
        clients={clients}
        members={members}
        hasTasks={hasTasks}
        currentUserId={currentUserId}
      />
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={`Delete ${project.name}?`}
        description="This permanently deletes the project with its tasks and files. Invoices and expenses are kept but unlinked."
        confirmLabel="Delete project"
        destructive
        onConfirm={async () => {
          const r = await run(() => deleteProjectAction({ id: project.id }), { success: "Project deleted" });
          if (r.ok) router.push("/dashboard/projects");
          return r.ok;
        }}
      />
    </>
  );
}

export function ProjectTaskList({
  projectId,
  tasks,
  projects,
  members,
  canWrite,
  canDelete,
  currentUserId,
}: {
  projectId: string;
  tasks: BoardTask[];
  projects: Option[];
  members: Option[];
  canWrite: boolean;
  canDelete: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const { run } = useAction();
  const [openId, setOpenId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const done = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {done} of {tasks.length} tasks done
        </p>
        {canWrite && (
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus /> Add task
          </Button>
        )}
      </div>
      {tasks.length === 0 ? (
        <EmptyState icon={CheckSquare} title="No tasks yet" description="Break this project into tasks to track progress automatically." compact />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {TASK_STATUSES.flatMap((s) => tasks.filter((t) => t.status === s.value)).map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
              <Checkbox
                checked={t.status === "done"}
                disabled={!canWrite}
                aria-label={t.status === "done" ? `Reopen ${t.title}` : `Complete ${t.title}`}
                onCheckedChange={async () => {
                  const status = t.status === "done" ? "todo" : "done";
                  const r = await run(() => setTaskStatusAction({ id: t.id, status }), { success: status === "done" ? "Task completed" : "Task reopened" });
                  if (r.ok) router.refresh();
                }}
              />
              <button type="button" onClick={() => setOpenId(t.id)} className="min-w-0 flex-1 text-left">
                <span className={cn("block truncate text-sm font-medium hover:underline", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</span>
                <span className="text-xs text-muted-foreground">{lookup(TASK_STATUSES, t.status).label}</span>
              </button>
              <PriorityLabel priority={t.priority} iconOnly />
              <span className="hidden sm:block">
                <DueDate date={t.due_date} done={t.status === "done"} />
              </span>
              {t.assignee && <UserAvatar name={t.assignee.name} src={t.assignee.avatarUrl} size="sm" />}
            </li>
          ))}
        </ul>
      )}
      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} defaults={{ projectId }} projects={projects} members={members} />
      <TaskDrawer taskId={openId} onClose={() => setOpenId(null)} projects={projects} members={members} canWrite={canWrite} canDelete={canDelete} currentUserId={currentUserId} />
    </div>
  );
}

const CATEGORIES = ["contractors", "software", "materials", "travel", "advertising", "general"];

export function ExpensesPanel({ projectId, expenses, canWrite, canDelete }: { projectId: string; expenses: ExpenseRow[]; canWrite: boolean; canDelete: boolean }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [adding, setAdding] = useState(false);
  const form = useForm<z.input<typeof expenseSchema>, unknown, z.output<typeof expenseSchema>>({
    resolver: zodResolver(expenseSchema),
    defaultValues: { projectId, description: "", category: "contractors", amount: "" as unknown as number, incurredOn: todayString() },
  });
  const { errors } = form.formState;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Expenses</h3>
        {canWrite && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus /> Log expense
          </Button>
        )}
      </div>
      {adding && (
        <form
          noValidate
          className="grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-[2fr_1fr_1fr_1fr_auto] sm:items-end"
          onSubmit={form.handleSubmit(async (values) => {
            const r = await run(() => addExpenseAction(values), { success: "Expense logged" });
            if (r.ok) {
              form.reset({ projectId, description: "", category: "contractors", amount: "" as unknown as number, incurredOn: todayString() });
              setAdding(false);
              router.refresh();
            }
          })}
        >
          <FormField id="exp-desc" label="Description" error={errors.description?.message}>
            <Input {...fieldA11y("exp-desc", errors.description?.message)} className="h-9" {...form.register("description")} />
          </FormField>
          <FormField id="exp-cat" label="Category">
            <select id="exp-cat" className="h-9 rounded-lg border bg-transparent px-2 text-sm dark:bg-input/30" {...form.register("category")}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="exp-amount" label="Amount" error={errors.amount?.message}>
            <Input {...fieldA11y("exp-amount", errors.amount?.message)} type="number" min={0} step="0.01" inputMode="decimal" className="h-9" {...form.register("amount")} />
          </FormField>
          <FormField id="exp-date" label="Date" error={errors.incurredOn?.message}>
            <Input {...fieldA11y("exp-date", errors.incurredOn?.message)} type="date" className="h-9" {...form.register("incurredOn")} />
          </FormField>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save
            </Button>
          </div>
        </form>
      )}
      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} title="No expenses logged" description="Log contractor, software or other costs to see true profitability." compact />
      ) : (
        <ul className="divide-y rounded-lg border">
          {expenses.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{e.description}</span>
                <span className="text-xs text-muted-foreground capitalize">
                  {e.category} · {formatDate(e.incurred_on)}
                </span>
              </span>
              <span className="tabular">{formatCurrency(Number(e.amount), "USD", { cents: true })}</span>
              {canDelete && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete expense ${e.description}`}
                  onClick={async () => {
                    const r = await run(() => deleteExpenseAction({ id: e.id }), { success: "Expense removed" });
                    if (r.ok) router.refresh();
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
