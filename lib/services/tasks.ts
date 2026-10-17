import "server-only";
import type { z } from "zod";
import { addDays, todayString, toDateString } from "@/lib/dates";
import type { WorkspaceContext } from "@/lib/server/context";
import { NotFoundError, UserFacingError } from "@/lib/server/errors";
import type { taskSchema } from "@/lib/validation/schemas";
import type { Priority, TaskRow, TaskStatus } from "@/types/database";
import { listActivity, logActivity } from "./activity";
import { assertMember, memberMap, personRef } from "./members";
import { notify } from "./notifications";
import { recomputeProgress } from "./projects";

type TaskData = z.output<typeof taskSchema>;

export interface TaskQuery {
  q?: string;
  projectId?: string;
  assigneeId?: string;
  priority?: Priority;
  status?: TaskStatus;
  label?: string;
  due?: "overdue" | "week";
}

export async function listTasks(ctx: WorkspaceContext, query: TaskQuery = {}) {
  const ws = ctx.workspace.id;
  const today = todayString();
  const [{ rows: tasks }, { rows: projects }, { rows: comments }, people] = await Promise.all([
    ctx.db.select("tasks", {
      eq: {
        workspace_id: ws,
        ...(query.projectId ? { project_id: query.projectId } : {}),
        ...(query.assigneeId ? { assignee_id: query.assigneeId === "unassigned" ? null : query.assigneeId } : {}),
        ...(query.priority ? { priority: query.priority } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      ...(query.due === "overdue" ? { lt: { due_date: today }, neq: { status: "done" } } : {}),
      ...(query.due === "week" ? { gte: { due_date: today }, lte: { due_date: toDateString(addDays(new Date(), 7)) } } : {}),
      ...(query.q ? { search: { columns: ["title", "description"], term: query.q } } : {}),
      order: [{ column: "position" }, { column: "created_at" }],
    }),
    ctx.db.select("projects", { eq: { workspace_id: ws } }),
    ctx.db.select("task_comments", { eq: { workspace_id: ws } }),
    memberMap(ctx),
  ]);
  return tasks
    .filter((t) => !query.label || t.labels.includes(query.label))
    .map((t) => ({
      ...t,
      project: (() => {
        const p = projects.find((pr) => pr.id === t.project_id);
        return p ? { id: p.id, name: p.name } : null;
      })(),
      assignee: personRef(t.assignee_id ? people.get(t.assignee_id) : undefined),
      commentCount: comments.filter((c) => c.task_id === t.id).length,
    }));
}

export type TaskListItem = Awaited<ReturnType<typeof listTasks>>[number];

export async function getTaskOrThrow(ctx: WorkspaceContext, id: string): Promise<TaskRow> {
  const task = await ctx.db.first("tasks", { eq: { id, workspace_id: ctx.workspace.id } });
  if (!task) throw new NotFoundError("That task doesn't exist or was deleted.");
  return task;
}

export async function getTaskDetail(ctx: WorkspaceContext, id: string) {
  const task = await ctx.db.first("tasks", { eq: { id, workspace_id: ctx.workspace.id } });
  if (!task) return null;
  const [{ rows: comments }, project, people, activity] = await Promise.all([
    ctx.db.select("task_comments", { eq: { workspace_id: ctx.workspace.id, task_id: id }, order: [{ column: "created_at" }] }),
    task.project_id ? ctx.db.first("projects", { eq: { id: task.project_id, workspace_id: ctx.workspace.id } }) : null,
    memberMap(ctx),
    listActivity(ctx, { entityIds: [id], limit: 20 }),
  ]);
  return {
    task,
    project: project ? { id: project.id, name: project.name } : null,
    assignee: personRef(task.assignee_id ? people.get(task.assignee_id) : undefined),
    comments: comments.map((c) => ({ ...c, author: personRef(c.author_id ? people.get(c.author_id) : undefined) })),
    activity: activity.items,
  };
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

async function validateRefs(ctx: WorkspaceContext, data: Pick<TaskData, "projectId" | "assigneeId">) {
  if (data.projectId) {
    const project = await ctx.db.first("projects", { eq: { id: data.projectId, workspace_id: ctx.workspace.id } });
    if (!project) throw new UserFacingError("Choose a project from this workspace.");
  }
  await assertMember(ctx, data.assigneeId);
}

async function nextPosition(ctx: WorkspaceContext, status: TaskStatus) {
  const last = await ctx.db.first("tasks", {
    eq: { workspace_id: ctx.workspace.id, status },
    order: [{ column: "position", ascending: false }],
  });
  return (last?.position ?? 0) + 1000;
}

async function notifyAssignment(ctx: WorkspaceContext, task: TaskRow, projectName: string | null) {
  if (!task.assignee_id) return;
  await notify(
    ctx,
    [task.assignee_id],
    {
      type: "task_assigned",
      title: `You were assigned: ${task.title}`,
      body: [projectName, task.due_date ? `due ${task.due_date}` : null].filter(Boolean).join(" · ") || null,
      link: `/dashboard/tasks?task=${task.id}`,
    },
    "tasks",
  );
}

async function projectName(ctx: WorkspaceContext, projectId: string | null) {
  if (!projectId) return null;
  return (await ctx.db.first("projects", { eq: { id: projectId, workspace_id: ctx.workspace.id } }))?.name ?? null;
}

export async function createTask(ctx: WorkspaceContext, data: TaskData) {
  await validateRefs(ctx, data);
  const task = await ctx.db.insert("tasks", {
    workspace_id: ctx.workspace.id,
    project_id: data.projectId,
    assignee_id: data.assigneeId,
    created_by: ctx.user.id,
    title: data.title,
    description: data.description,
    status: data.status,
    priority: data.priority,
    due_date: data.dueDate,
    labels: data.labels,
    position: await nextPosition(ctx, data.status),
    completed_at: data.status === "done" ? new Date().toISOString() : null,
  });
  await logActivity(ctx, "task.created", { type: "task", id: task.id, name: task.title });
  await notifyAssignment(ctx, task, await projectName(ctx, task.project_id));
  await recomputeProgress(ctx, task.project_id);
  return task;
}

async function recordChanges(ctx: WorkspaceContext, before: TaskRow, after: TaskRow) {
  const entity = { type: "task", id: after.id, name: after.title };
  if (before.status !== after.status) {
    if (after.status === "done") await logActivity(ctx, "task.completed", entity);
    else await logActivity(ctx, "task.status_changed", entity, { from: before.status, to: after.status });
  }
  if (before.assignee_id !== after.assignee_id && after.assignee_id) {
    const people = await memberMap(ctx);
    await logActivity(ctx, "task.assigned", entity, { assignee: people.get(after.assignee_id)?.name ?? "a teammate" });
    await notifyAssignment(ctx, after, await projectName(ctx, after.project_id));
  }
  if (before.status !== after.status || before.project_id !== after.project_id) {
    await recomputeProgress(ctx, after.project_id);
    if (before.project_id !== after.project_id) await recomputeProgress(ctx, before.project_id);
  }
}

export async function updateTask(ctx: WorkspaceContext, id: string, data: TaskData) {
  const before = await getTaskOrThrow(ctx, id);
  await validateRefs(ctx, data);
  const statusChanged = before.status !== data.status;
  const [task] = await ctx.db.update(
    "tasks",
    { eq: { id, workspace_id: ctx.workspace.id } },
    {
      project_id: data.projectId,
      assignee_id: data.assigneeId,
      title: data.title,
      description: data.description,
      status: data.status,
      priority: data.priority,
      due_date: data.dueDate,
      labels: data.labels,
      ...(statusChanged
        ? {
            position: await nextPosition(ctx, data.status),
            completed_at: data.status === "done" ? new Date().toISOString() : null,
          }
        : {}),
    },
  );
  await recordChanges(ctx, before, task);
  if (!statusChanged && before.assignee_id === task.assignee_id) {
    await logActivity(ctx, "task.updated", { type: "task", id, name: task.title });
  }
  return task;
}

/** Moves a task to a column, placing it before `beforeId` (or at the end). */
export async function moveTask(ctx: WorkspaceContext, id: string, status: TaskStatus, beforeId: string | null) {
  const before = await getTaskOrThrow(ctx, id);
  const { rows: column } = await ctx.db.select("tasks", {
    eq: { workspace_id: ctx.workspace.id, status },
    neq: { id },
    order: [{ column: "position" }],
  });
  let position: number;
  const index = beforeId ? column.findIndex((t) => t.id === beforeId) : -1;
  if (index === -1) position = (column.at(-1)?.position ?? 0) + 1000;
  else if (index === 0) position = column[0].position - 1000;
  else position = (column[index - 1].position + column[index].position) / 2;

  const [task] = await ctx.db.update(
    "tasks",
    { eq: { id, workspace_id: ctx.workspace.id } },
    {
      status,
      position,
      ...(before.status !== status ? { completed_at: status === "done" ? new Date().toISOString() : null } : {}),
    },
  );
  await recordChanges(ctx, before, task);
  return task;
}

export async function setTaskStatus(ctx: WorkspaceContext, id: string, status: TaskStatus) {
  return moveTask(ctx, id, status, null);
}

export async function deleteTask(ctx: WorkspaceContext, id: string) {
  const task = await getTaskOrThrow(ctx, id);
  await ctx.db.remove("tasks", { eq: { id, workspace_id: ctx.workspace.id } });
  await logActivity(ctx, "task.deleted", { type: "task", id: null, name: task.title });
  await recomputeProgress(ctx, task.project_id);
}

export async function addComment(ctx: WorkspaceContext, taskId: string, body: string) {
  const task = await getTaskOrThrow(ctx, taskId);
  const comment = await ctx.db.insert("task_comments", {
    workspace_id: ctx.workspace.id,
    task_id: taskId,
    author_id: ctx.user.id,
    body,
  });
  await logActivity(ctx, "comment.added", { type: "task", id: taskId, name: task.title });
  await notify(
    ctx,
    [task.assignee_id, task.created_by],
    {
      type: "task_comment",
      title: `New comment on ${task.title}`,
      body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
      link: `/dashboard/tasks?task=${taskId}`,
    },
    "tasks",
  );
  return comment;
}

export async function deleteComment(ctx: WorkspaceContext, id: string) {
  const comment = await ctx.db.first("task_comments", { eq: { id, workspace_id: ctx.workspace.id } });
  if (!comment) throw new NotFoundError("That comment was already deleted.");
  if (comment.author_id !== ctx.user.id && ctx.role !== "owner" && ctx.role !== "admin") {
    throw new UserFacingError("You can only delete your own comments.");
  }
  await ctx.db.remove("task_comments", { eq: { id, workspace_id: ctx.workspace.id } });
}
