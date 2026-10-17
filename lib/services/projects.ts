import "server-only";
import type { z } from "zod";
import { getBackend } from "@/lib/backend";
import { isProjectAtRisk } from "@/lib/project-health";
import { PLANS } from "@/lib/plans";
import type { WorkspaceContext } from "@/lib/server/context";
import { NotFoundError, PlanLimitError, UserFacingError } from "@/lib/server/errors";
import type { expenseSchema, projectSchema } from "@/lib/validation/schemas";
import type { ProjectRow, ProjectStatus } from "@/types/database";
import { listActivity, logActivity } from "./activity";
import { ACTIVE_PROJECT_STATUSES, touchClient } from "./clients";
import { assertMember, memberMap, personRef } from "./members";
import { notify } from "./notifications";

type ProjectData = z.output<typeof projectSchema>;
type ExpenseData = z.output<typeof expenseSchema>;

export interface ProjectQuery {
  q?: string;
  status?: ProjectStatus | "all";
  clientId?: string;
  ownerId?: string;
}

export async function listProjects(ctx: WorkspaceContext, query: ProjectQuery = {}) {
  const ws = ctx.workspace.id;
  const [{ rows: projects }, { rows: clients }, { rows: tasks }, { rows: memberRows }, people] = await Promise.all([
    ctx.db.select("projects", {
      eq: {
        workspace_id: ws,
        ...(query.status && query.status !== "all" ? { status: query.status } : {}),
        ...(query.clientId ? { client_id: query.clientId } : {}),
        ...(query.ownerId ? { owner_id: query.ownerId } : {}),
      },
      ...(query.q ? { search: { columns: ["name", "description"], term: query.q } } : {}),
      order: [{ column: "due_date" }],
    }),
    ctx.db.select("clients", { eq: { workspace_id: ws } }),
    ctx.db.select("tasks", { eq: { workspace_id: ws } }),
    ctx.db.select("project_members", { eq: { workspace_id: ws } }),
    memberMap(ctx),
  ]);
  return projects.map((p) => {
    const projectTasks = tasks.filter((t) => t.project_id === p.id);
    return {
      ...p,
      client: clients.find((c) => c.id === p.client_id) ?? null,
      owner: personRef(p.owner_id ? people.get(p.owner_id) : undefined),
      members: memberRows
        .filter((m) => m.project_id === p.id)
        .map((m) => personRef(people.get(m.user_id)))
        .filter((m) => m !== null),
      taskCount: projectTasks.length,
      openTaskCount: projectTasks.filter((t) => t.status !== "done").length,
      atRisk: isProjectAtRisk(p),
    };
  });
}

export async function getProjectOrThrow(ctx: WorkspaceContext, id: string): Promise<ProjectRow> {
  const project = await ctx.db.first("projects", { eq: { id, workspace_id: ctx.workspace.id } });
  if (!project) throw new NotFoundError("That project doesn't exist or was deleted.");
  return project;
}

export async function getProjectDetail(ctx: WorkspaceContext, id: string) {
  const ws = ctx.workspace.id;
  const project = await ctx.db.first("projects", { eq: { id, workspace_id: ws } });
  if (!project) return null;
  const [client, { rows: tasks }, { rows: memberRows }, { rows: invoices }, { rows: expenses }, { rows: files }, people] =
    await Promise.all([
      project.client_id ? ctx.db.first("clients", { eq: { id: project.client_id, workspace_id: ws } }) : null,
      ctx.db.select("tasks", { eq: { workspace_id: ws, project_id: id }, order: [{ column: "position" }] }),
      ctx.db.select("project_members", { eq: { workspace_id: ws, project_id: id } }),
      ctx.db.select("invoices", { eq: { workspace_id: ws, project_id: id }, order: [{ column: "issue_date", ascending: false }] }),
      ctx.db.select("expenses", { eq: { workspace_id: ws, project_id: id }, order: [{ column: "incurred_on", ascending: false }] }),
      ctx.db.select("files", { eq: { workspace_id: ws, project_id: id }, order: [{ column: "created_at", ascending: false }] }),
      memberMap(ctx),
    ]);
  const activity = await listActivity(ctx, { entityIds: [id, ...tasks.map((t) => t.id), ...invoices.map((i) => i.id)], limit: 20 });

  const billable = invoices.filter((i) => i.status !== "draft" && i.status !== "cancelled");
  const billed = billable.reduce((s, i) => s + Number(i.subtotal), 0);
  const paid = invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.subtotal), 0);
  const outstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((s, i) => s + Number(i.total), 0);
  const costs = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return {
    project,
    client,
    owner: personRef(project.owner_id ? people.get(project.owner_id) : undefined),
    members: memberRows.map((m) => people.get(m.user_id)).filter((m) => m !== undefined),
    tasks: tasks.map((t) => ({ ...t, assignee: personRef(t.assignee_id ? people.get(t.assignee_id) : undefined) })),
    invoices,
    expenses,
    files: files.map((f) => ({ ...f, uploader: personRef(f.uploaded_by ? people.get(f.uploaded_by) : undefined) })),
    activity: activity.items,
    atRisk: isProjectAtRisk(project),
    financials: {
      budget: Number(project.budget),
      billed,
      paid,
      outstanding,
      costs,
      profit: paid - costs,
      remainingBudget: Number(project.budget) - billed,
    },
  };
}

async function assertProjectLimit(ctx: WorkspaceContext, excludingId?: string) {
  const limit = PLANS[ctx.plan].limits.activeProjects;
  if (!Number.isFinite(limit)) return;
  const { rows } = await ctx.db.select("projects", {
    eq: { workspace_id: ctx.workspace.id },
    in: { status: [...ACTIVE_PROJECT_STATUSES] },
  });
  if (rows.filter((p) => p.id !== excludingId).length >= limit) {
    throw new PlanLimitError(
      `The ${PLANS[ctx.plan].name} plan includes ${limit} active projects. Complete or pause a project, or upgrade to Pro for unlimited projects.`,
    );
  }
}

async function validateRefs(ctx: WorkspaceContext, data: ProjectData) {
  if (data.clientId) {
    const client = await ctx.db.first("clients", { eq: { id: data.clientId, workspace_id: ctx.workspace.id } });
    if (!client) throw new UserFacingError("Choose a client from this workspace.");
  }
  await assertMember(ctx, data.ownerId);
  for (const memberId of data.memberIds) await assertMember(ctx, memberId);
}

async function syncMembers(ctx: WorkspaceContext, projectId: string, memberIds: string[]) {
  const ws = ctx.workspace.id;
  const { rows: current } = await ctx.db.select("project_members", { eq: { workspace_id: ws, project_id: projectId } });
  const currentIds = current.map((m) => m.user_id);
  const toAdd = memberIds.filter((id) => !currentIds.includes(id));
  const toRemove = currentIds.filter((id) => !memberIds.includes(id));
  if (toRemove.length) {
    await ctx.db.remove("project_members", { eq: { workspace_id: ws, project_id: projectId }, in: { user_id: toRemove } });
  }
  if (toAdd.length) {
    await ctx.db.insertMany("project_members", toAdd.map((user_id) => ({ workspace_id: ws, project_id: projectId, user_id })));
  }
  return toAdd;
}

export async function createProject(ctx: WorkspaceContext, data: ProjectData) {
  if ((ACTIVE_PROJECT_STATUSES as readonly string[]).includes(data.status)) await assertProjectLimit(ctx);
  await validateRefs(ctx, data);
  const ownerId = data.ownerId ?? ctx.user.id;
  const project = await ctx.db.insert("projects", {
    workspace_id: ctx.workspace.id,
    client_id: data.clientId,
    owner_id: ownerId,
    name: data.name,
    description: data.description,
    status: data.status,
    priority: data.priority,
    start_date: data.startDate,
    due_date: data.dueDate,
    progress: data.status === "completed" ? 100 : data.progress,
    budget: data.budget,
  });
  const added = await syncMembers(ctx, project.id, Array.from(new Set([ownerId, ...data.memberIds])));
  await logActivity(ctx, "project.created", { type: "project", id: project.id, name: project.name });
  await touchClient(ctx, project.client_id);
  await notify(ctx, added, {
    type: "project_added",
    title: `You were added to ${project.name}`,
    body: data.dueDate ? `Due ${data.dueDate}` : null,
    link: `/dashboard/projects/${project.id}`,
  });
  return project;
}

export async function updateProject(ctx: WorkspaceContext, id: string, data: ProjectData) {
  const existing = await getProjectOrThrow(ctx, id);
  const reopening =
    !(ACTIVE_PROJECT_STATUSES as readonly string[]).includes(existing.status) &&
    (ACTIVE_PROJECT_STATUSES as readonly string[]).includes(data.status);
  if (reopening) await assertProjectLimit(ctx, id);
  await validateRefs(ctx, data);
  const { count: taskCount } = await ctx.db.select("tasks", { eq: { workspace_id: ctx.workspace.id, project_id: id }, limit: 1 });
  const [project] = await ctx.db.update(
    "projects",
    { eq: { id, workspace_id: ctx.workspace.id } },
    {
      client_id: data.clientId,
      owner_id: data.ownerId ?? existing.owner_id,
      name: data.name,
      description: data.description,
      status: data.status,
      priority: data.priority,
      start_date: data.startDate,
      due_date: data.dueDate,
      // With tasks, progress is derived from completed tasks; otherwise it's set manually.
      progress: data.status === "completed" ? 100 : taskCount > 0 ? existing.progress : data.progress,
      budget: data.budget,
    },
  );
  const added = await syncMembers(ctx, id, Array.from(new Set([project.owner_id, ...data.memberIds].filter((m): m is string => !!m))));
  if (existing.status !== data.status) {
    await logActivity(ctx, "project.status_changed", { type: "project", id, name: project.name }, { from: existing.status, to: data.status });
  } else {
    await logActivity(ctx, "project.updated", { type: "project", id, name: project.name });
  }
  await notify(ctx, added, { type: "project_added", title: `You were added to ${project.name}`, link: `/dashboard/projects/${id}` });
  await touchClient(ctx, project.client_id);
  return project;
}

export async function setProjectStatus(ctx: WorkspaceContext, id: string, status: ProjectStatus) {
  const existing = await getProjectOrThrow(ctx, id);
  if (existing.status === status) return existing;
  const reopening =
    !(ACTIVE_PROJECT_STATUSES as readonly string[]).includes(existing.status) &&
    (ACTIVE_PROJECT_STATUSES as readonly string[]).includes(status);
  if (reopening) await assertProjectLimit(ctx, id);
  const [project] = await ctx.db.update(
    "projects",
    { eq: { id, workspace_id: ctx.workspace.id } },
    { status, ...(status === "completed" ? { progress: 100 } : {}) },
  );
  await logActivity(ctx, "project.status_changed", { type: "project", id, name: project.name }, { from: existing.status, to: status });
  return project;
}

export async function deleteProject(ctx: WorkspaceContext, id: string) {
  const existing = await getProjectOrThrow(ctx, id);
  const { rows: files } = await ctx.db.select("files", { eq: { workspace_id: ctx.workspace.id, project_id: id } });
  await ctx.db.remove("projects", { eq: { id, workspace_id: ctx.workspace.id } });
  if (files.length) await (await getBackend().storage()).removePrivate(files.map((f) => f.storage_path));
  await logActivity(ctx, "project.deleted", { type: "project", id: null, name: existing.name });
}

/** Keeps project progress in sync with the share of completed tasks. */
export async function recomputeProgress(ctx: WorkspaceContext, projectId: string | null) {
  if (!projectId) return;
  const { rows } = await ctx.db.select("tasks", { eq: { workspace_id: ctx.workspace.id, project_id: projectId } });
  if (!rows.length) return;
  const progress = Math.round((rows.filter((t) => t.status === "done").length / rows.length) * 100);
  await ctx.db.update("projects", { eq: { id: projectId, workspace_id: ctx.workspace.id } }, { progress });
}

export async function addExpense(ctx: WorkspaceContext, data: ExpenseData) {
  if (data.projectId) await getProjectOrThrow(ctx, data.projectId);
  const expense = await ctx.db.insert("expenses", {
    workspace_id: ctx.workspace.id,
    project_id: data.projectId,
    description: data.description,
    category: data.category,
    amount: data.amount,
    incurred_on: data.incurredOn,
    created_by: ctx.user.id,
  });
  await logActivity(ctx, "expense.created", { type: "project", id: data.projectId, name: data.description }, { amount: data.amount });
  return expense;
}

export async function deleteExpense(ctx: WorkspaceContext, id: string) {
  const removed = await ctx.db.remove("expenses", { eq: { id, workspace_id: ctx.workspace.id } });
  if (!removed) throw new NotFoundError("That expense was already removed.");
}

export async function projectOptions(ctx: WorkspaceContext) {
  const { rows } = await ctx.db.select("projects", { eq: { workspace_id: ctx.workspace.id }, order: [{ column: "name" }] });
  return rows.map((p) => ({ id: p.id, label: p.name, clientId: p.client_id, status: p.status }));
}
