import "server-only";
import { randomBytes } from "node:crypto";
import { publicEnv } from "@/lib/env";
import { roleRank, ROLE_LABELS } from "@/lib/permissions";
import { formatLimit, PLANS } from "@/lib/plans";
import type { WorkspaceContext } from "@/lib/server/context";
import { ForbiddenError, NotFoundError, PlanLimitError, UserFacingError } from "@/lib/server/errors";
import type { WorkspaceRole } from "@/types/database";
import { listActivity, logActivity } from "./activity";
import { listMembers } from "./members";
import { adminIds, notify } from "./notifications";

export async function getTeam(ctx: WorkspaceContext) {
  const ws = ctx.workspace.id;
  const [members, { rows: projectMembers }, { rows: projects }, { rows: tasks }, invitations] = await Promise.all([
    listMembers(ctx),
    ctx.db.select("project_members", { eq: { workspace_id: ws } }),
    ctx.db.select("projects", { eq: { workspace_id: ws } }),
    ctx.db.select("tasks", { eq: { workspace_id: ws } }),
    roleRank(ctx.role) >= roleRank("admin")
      ? ctx.db.select("workspace_invitations", {
          eq: { workspace_id: ws, accepted_at: null },
          order: [{ column: "created_at", ascending: false }],
        })
      : Promise.resolve({ rows: [], count: 0 }),
  ]);
  return {
    members: members.map((m) => {
      const projectIds = new Set([
        ...projectMembers.filter((pm) => pm.user_id === m.userId).map((pm) => pm.project_id),
        ...projects.filter((p) => p.owner_id === m.userId).map((p) => p.id),
      ]);
      const assigned = tasks.filter((t) => t.assignee_id === m.userId);
      return {
        ...m,
        projects: projects.filter((p) => projectIds.has(p.id)).map((p) => ({ id: p.id, name: p.name, status: p.status })),
        openTasks: assigned.filter((t) => t.status !== "done").length,
        completedTasks: assigned.filter((t) => t.status === "done").length,
      };
    }),
    invitations: invitations.rows.map((i) => ({
      ...i,
      expired: new Date(i.expires_at) <= new Date(),
      link: `${publicEnv.appUrl}/invite/${i.token}`,
    })),
    seats: { used: members.length + invitations.rows.length, limit: PLANS[ctx.plan].limits.users },
  };
}

export async function memberActivity(ctx: WorkspaceContext, userId: string) {
  return (await listActivity(ctx, { actorId: userId, limit: 25 })).items;
}

export async function inviteMember(ctx: WorkspaceContext, email: string, role: Exclude<WorkspaceRole, "owner">) {
  const ws = ctx.workspace.id;
  if (role === "admin" && ctx.role !== "owner" && ctx.role !== "admin") throw new ForbiddenError();

  const members = await listMembers(ctx);
  if (members.some((m) => m.email.toLowerCase() === email)) {
    throw new UserFacingError(`${email} is already a member of ${ctx.workspace.name}.`);
  }
  const { rows: pending } = await ctx.db.select("workspace_invitations", { eq: { workspace_id: ws, accepted_at: null } });
  const existing = pending.find((i) => i.email.toLowerCase() === email);

  const limit = PLANS[ctx.plan].limits.users;
  if (!existing && members.length + pending.length >= limit) {
    throw new PlanLimitError(
      `Your ${PLANS[ctx.plan].name} plan includes ${formatLimit(limit)} ${limit === 1 ? "user" : "users"}. Upgrade to add more teammates.`,
    );
  }

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + 14 * 86_400_000).toISOString();
  const invitation = existing
    ? (await ctx.db.update("workspace_invitations", { eq: { id: existing.id, workspace_id: ws } }, { role, token, expires_at: expiresAt, invited_by: ctx.user.id }))[0]
    : await ctx.db.insert("workspace_invitations", {
        workspace_id: ws,
        email,
        role,
        token,
        invited_by: ctx.user.id,
        accepted_at: null,
        expires_at: expiresAt,
      });

  await logActivity(ctx, "member.invited", { type: "member", id: null, name: email }, { role });
  await notify(ctx, await adminIds(ctx), {
    type: "member_invited",
    title: `${email} was invited`,
    body: `${ctx.profile.full_name || ctx.profile.email} invited them as ${ROLE_LABELS[role]}.`,
    link: "/dashboard/team",
  });
  return { invitation, link: `${publicEnv.appUrl}/invite/${invitation.token}` };
}

export async function revokeInvitation(ctx: WorkspaceContext, id: string) {
  const removed = await ctx.db.remove("workspace_invitations", { eq: { id, workspace_id: ctx.workspace.id } });
  if (!removed) throw new NotFoundError("That invitation no longer exists.");
}

async function targetMember(ctx: WorkspaceContext, userId: string) {
  const member = await ctx.db.first("workspace_members", { eq: { workspace_id: ctx.workspace.id, user_id: userId } });
  if (!member) throw new NotFoundError("That person isn't a member of this workspace.");
  return member;
}

async function ownerCount(ctx: WorkspaceContext) {
  const { count } = await ctx.db.select("workspace_members", { eq: { workspace_id: ctx.workspace.id, role: "owner" }, limit: 1 });
  return count;
}

export async function changeRole(ctx: WorkspaceContext, userId: string, role: WorkspaceRole) {
  const member = await targetMember(ctx, userId);
  if (member.role === role) return;
  // Only owners may grant or revoke the owner role; admins can't change other admins' roles upward.
  if ((role === "owner" || member.role === "owner") && ctx.role !== "owner") {
    throw new ForbiddenError("Only owners can change who owns the workspace.");
  }
  if (ctx.role === "admin" && member.role === "admin" && userId !== ctx.user.id) {
    throw new ForbiddenError("Admins can't change another admin's role. Ask an owner.");
  }
  if (member.role === "owner" && (await ownerCount(ctx)) <= 1) {
    throw new UserFacingError("A workspace needs at least one owner. Make someone else an owner first.");
  }
  await ctx.db.update("workspace_members", { eq: { workspace_id: ctx.workspace.id, user_id: userId } }, { role });
  const profile = await ctx.db.first("profiles", { eq: { id: userId } });
  await logActivity(ctx, "member.role_changed", { type: "member", id: userId, name: profile?.full_name ?? "a member" }, { from: member.role, to: role });
  await notify(ctx, [userId], {
    type: "role_changed",
    title: `Your role in ${ctx.workspace.name} is now ${ROLE_LABELS[role]}`,
    link: "/dashboard/team",
  });
}

export async function removeMember(ctx: WorkspaceContext, userId: string) {
  const member = await targetMember(ctx, userId);
  if (userId === ctx.user.id) throw new UserFacingError("You can't remove yourself. Use “Leave workspace” in settings.");
  if (member.role === "owner") throw new ForbiddenError("Owners can't be removed. Change their role first.");
  if (member.role === "admin" && ctx.role !== "owner") throw new ForbiddenError("Only owners can remove admins.");
  const profile = await ctx.db.first("profiles", { eq: { id: userId } });
  await ctx.db.remove("workspace_members", { eq: { workspace_id: ctx.workspace.id, user_id: userId } });
  await logActivity(ctx, "member.removed", { type: "member", id: userId, name: profile?.full_name ?? profile?.email ?? "a member" });
}

export async function leaveWorkspace(ctx: WorkspaceContext) {
  if (ctx.role === "owner" && (await ownerCount(ctx)) <= 1) {
    throw new UserFacingError("You're the only owner. Transfer ownership or delete the workspace instead.");
  }
  if (ctx.role === "owner") {
    await ctx.db.update("workspace_members", { eq: { workspace_id: ctx.workspace.id, user_id: ctx.user.id } }, { role: "member" });
  }
  await ctx.db.remove("workspace_members", { eq: { workspace_id: ctx.workspace.id, user_id: ctx.user.id } });
}
