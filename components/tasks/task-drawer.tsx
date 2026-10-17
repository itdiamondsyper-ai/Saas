"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CalendarDays, FolderKanban, Loader2, Pencil, Send, Trash2, UserRound } from "lucide-react";
import type { Option } from "@/components/projects/project-form-dialog";
import { PriorityLabel } from "@/components/shared/badges";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/hooks/use-action";
import { addCommentAction, deleteCommentAction, deleteTaskAction, getTaskDetailAction, setTaskStatusAction } from "@/lib/actions/records";
import { TASK_STATUSES } from "@/lib/constants";
import { isOverdue } from "@/lib/dates";
import { formatDate, formatRelative } from "@/lib/format";
import type { TaskDetail } from "@/lib/services/tasks";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/database";
import { TaskFormDialog } from "./task-form-dialog";

export function TaskDrawer({
  taskId,
  onClose,
  projects,
  members,
  canWrite,
  canDelete,
  currentUserId,
}: {
  taskId: string | null;
  onClose: () => void;
  projects: Option[];
  members: Option[];
  canWrite: boolean;
  canDelete: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const applyResult = useCallback((result: Awaited<ReturnType<typeof getTaskDetailAction>> | null) => {
    if (result?.ok && result.data) {
      setDetail(result.data);
      setLoadError(null);
    } else {
      setLoadError(result?.ok ? "This task no longer exists." : (result?.error ?? "We couldn't load this task."));
    }
  }, []);
  const load = useCallback(
    (id: string) =>
      getTaskDetailAction({ id })
        .catch(() => null)
        .then(applyResult),
    [applyResult],
  );

  const [lastTaskId, setLastTaskId] = useState(taskId);
  if (taskId !== lastTaskId) {
    setLastTaskId(taskId);
    setDetail(null);
    setLoadError(null);
    setComment("");
  }
  useEffect(() => {
    if (!taskId) return;
    let cancelled = false;
    getTaskDetailAction({ id: taskId })
      .catch(() => null)
      .then((result) => {
        if (!cancelled) applyResult(result);
      });
    return () => {
      cancelled = true;
    };
  }, [taskId, applyResult]);

  const refresh = async () => {
    if (taskId) await load(taskId);
    router.refresh();
  };

  const task = detail?.task;
  return (
    <>
      <Sheet open={!!taskId} onOpenChange={(open) => !open && onClose()}>
        <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-lg">
          {!task ? (
            <div className="space-y-4 p-6">
              <SheetTitle className="sr-only">Task details</SheetTitle>
              <SheetDescription className="sr-only">Loading task</SheetDescription>
              {loadError ? (
                <p role="alert" className="text-sm text-destructive">
                  {loadError}
                </p>
              ) : (
                <>
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-32 w-full" />
                </>
              )}
            </div>
          ) : (
            <>
              <SheetHeader className="border-b pr-12">
                <SheetTitle className="text-lg leading-snug font-semibold">{task.title}</SheetTitle>
                <SheetDescription>
                  Created {formatRelative(task.created_at)}
                  {task.completed_at ? ` · completed ${formatRelative(task.completed_at)}` : ""}
                </SheetDescription>
                {canWrite && (
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
                      <Pencil /> Edit
                    </Button>
                    {canDelete && (
                      <Button variant="outline" size="sm" onClick={() => setDeleteOpen(true)}>
                        <Trash2 /> Delete
                      </Button>
                    )}
                  </div>
                )}
              </SheetHeader>
              <div className="space-y-6 p-4">
                <dl className="grid grid-cols-[110px_1fr] items-center gap-x-3 gap-y-3 text-sm">
                  <dt className="text-muted-foreground">Status</dt>
                  <dd>
                    <NativeSelect
                      aria-label="Task status"
                      value={task.status}
                      disabled={!canWrite || pending}
                      className="w-44"
                      onChange={async (e) => {
                        const status = e.target.value as TaskStatus;
                        const r = await run(() => setTaskStatusAction({ id: task.id, status }), {
                          success: status === "done" ? "Task completed" : "Status updated",
                        });
                        if (r.ok) await refresh();
                      }}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </dd>
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <UserRound className="size-3.5" /> Assignee
                  </dt>
                  <dd className="flex items-center gap-2">
                    {detail.assignee ? (
                      <>
                        <UserAvatar name={detail.assignee.name} src={detail.assignee.avatarUrl} size="sm" /> {detail.assignee.name}
                      </>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Priority</dt>
                  <dd>
                    <PriorityLabel priority={task.priority} className="text-sm" />
                  </dd>
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <CalendarDays className="size-3.5" /> Due date
                  </dt>
                  <dd className={cn(task.status !== "done" && isOverdue(task.due_date) && "font-medium text-destructive")}>
                    {task.due_date ? formatDate(task.due_date, "long") : "No due date"}
                    {task.status !== "done" && isOverdue(task.due_date) && " · overdue"}
                  </dd>
                  <dt className="flex items-center gap-1.5 text-muted-foreground">
                    <FolderKanban className="size-3.5" /> Project
                  </dt>
                  <dd>
                    {detail.project ? (
                      <Link href={`/dashboard/projects/${detail.project.id}`} className="text-primary hover:underline">
                        {detail.project.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">None</span>
                    )}
                  </dd>
                  {task.labels.length > 0 && (
                    <>
                      <dt className="text-muted-foreground">Labels</dt>
                      <dd className="flex flex-wrap gap-1.5">
                        {task.labels.map((l) => (
                          <span key={l} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                            {l}
                          </span>
                        ))}
                      </dd>
                    </>
                  )}
                </dl>

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Description</h3>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{task.description || "No description."}</p>
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Comments ({detail.comments.length})</h3>
                  <ul className="space-y-3">
                    {detail.comments.map((c) => (
                      <li key={c.id} className="flex gap-2.5">
                        <UserAvatar name={c.author?.name ?? "Former member"} src={c.author?.avatarUrl} size="sm" className="mt-0.5" />
                        <div className="min-w-0 flex-1 rounded-lg bg-muted/50 px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-medium">
                              {c.author?.name ?? "Former member"} <span className="font-normal text-muted-foreground">· {formatRelative(c.created_at)}</span>
                            </p>
                            {canWrite && c.author_id === currentUserId && (
                              <button
                                type="button"
                                className="text-xs text-muted-foreground hover:text-destructive"
                                onClick={async () => {
                                  const r = await run(() => deleteCommentAction({ id: c.id }), { success: "Comment deleted" });
                                  if (r.ok) await refresh();
                                }}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                          <p className="mt-1 text-sm whitespace-pre-wrap">{c.body}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {canWrite && (
                    <form
                      className="flex items-end gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        if (!comment.trim()) return;
                        const r = await run(() => addCommentAction({ taskId: task.id, body: comment }));
                        if (r.ok) {
                          setComment("");
                          await refresh();
                        }
                      }}
                    >
                      <label htmlFor="new-comment" className="sr-only">
                        Add a comment
                      </label>
                      <Textarea
                        id="new-comment"
                        rows={2}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Write a comment…"
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
                        }}
                      />
                      <Button type="submit" size="icon" aria-label="Post comment" disabled={pending || !comment.trim()}>
                        {pending ? <Loader2 className="animate-spin" /> : <Send />}
                      </Button>
                    </form>
                  )}
                </section>

                <section className="space-y-3">
                  <h3 className="text-sm font-semibold">Activity</h3>
                  {detail.activity.length ? (
                    <ol className="space-y-2 border-l pl-4">
                      {detail.activity.map((a) => (
                        <li key={a.id} className="text-xs">
                          <span className="text-foreground">{a.sentence}</span>
                          <span className="text-muted-foreground"> · {formatRelative(a.createdAt)}</span>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-muted-foreground">No activity yet.</p>
                  )}
                </section>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      {task && (
        <TaskFormDialog open={editOpen} onOpenChange={setEditOpen} task={task} projects={projects} members={members} onSaved={() => void refresh()} />
      )}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this task?"
        description={`“${task?.title ?? ""}” and its comments will be permanently deleted.`}
        confirmLabel="Delete task"
        destructive
        onConfirm={async () => {
          if (!task) return;
          const r = await run(() => deleteTaskAction({ id: task.id }), { success: "Task deleted" });
          if (r.ok) {
            onClose();
            router.refresh();
          }
          return r.ok;
        }}
      />
    </>
  );
}
