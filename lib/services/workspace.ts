import "server-only";
import { getBackend } from "@/lib/backend";
import type { WorkspaceContext } from "@/lib/server/context";
import { UserFacingError } from "@/lib/server/errors";
import type { NotificationPrefs } from "@/types/database";
import { logActivity } from "./activity";
import { uploadPublicImage } from "./files";

export async function updateWorkspace(
  ctx: WorkspaceContext,
  patch: { name?: string; industry?: string | null; teamSize?: string | null; primaryGoal?: string | null; onboardingCompleted?: boolean },
) {
  const [workspace] = await ctx.db.update(
    "workspaces",
    { eq: { id: ctx.workspace.id } },
    {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.industry !== undefined ? { industry: patch.industry } : {}),
      ...(patch.teamSize !== undefined ? { team_size: patch.teamSize } : {}),
      ...(patch.primaryGoal !== undefined ? { primary_goal: patch.primaryGoal } : {}),
      ...(patch.onboardingCompleted !== undefined ? { onboarding_completed: patch.onboardingCompleted } : {}),
    },
  );
  if (!workspace) throw new UserFacingError("Only admins can change workspace settings.");
  const fields = Object.keys(patch).filter((k) => k !== "onboardingCompleted");
  if (fields.length && ctx.workspace.onboarding_completed) {
    await logActivity(ctx, "settings.updated", { type: "workspace", id: workspace.id, name: workspace.name }, { fields });
  }
  return workspace;
}

export async function uploadWorkspaceLogo(ctx: WorkspaceContext, file: File) {
  const url = await uploadPublicImage(`workspaces/${ctx.workspace.id}/logo`, file);
  await ctx.db.update("workspaces", { eq: { id: ctx.workspace.id } }, { logo_url: url });
  await logActivity(ctx, "settings.updated", { type: "workspace", id: ctx.workspace.id, name: ctx.workspace.name }, { fields: ["logo"] });
  return url;
}

export async function removeWorkspaceLogo(ctx: WorkspaceContext) {
  await ctx.db.update("workspaces", { eq: { id: ctx.workspace.id } }, { logo_url: null });
}

export async function updateProfile(ctx: WorkspaceContext, patch: { fullName: string; jobTitle: string | null }) {
  await ctx.db.update("profiles", { eq: { id: ctx.user.id } }, { full_name: patch.fullName, job_title: patch.jobTitle });
}

export async function uploadAvatar(ctx: WorkspaceContext, file: File) {
  const url = await uploadPublicImage(`users/${ctx.user.id}/avatar`, file);
  await ctx.db.update("profiles", { eq: { id: ctx.user.id } }, { avatar_url: url });
  return url;
}

export async function removeAvatar(ctx: WorkspaceContext) {
  await ctx.db.update("profiles", { eq: { id: ctx.user.id } }, { avatar_url: null });
}

export async function updateNotificationPrefs(ctx: WorkspaceContext, prefs: NotificationPrefs) {
  await ctx.db.update("profiles", { eq: { id: ctx.user.id } }, { notification_prefs: prefs });
}

/**
 * Deletes the user's account. Workspaces where they're the only owner are deleted
 * with it (after explicit confirmation in the UI); other memberships are removed.
 */
export async function deleteAccount(ctx: WorkspaceContext) {
  const backend = getBackend();
  if (!backend.adminDb()) {
    throw new UserFacingError("Account deletion isn't configured on this server. Contact support to delete your account.");
  }
  for (const membership of ctx.memberships) {
    if (membership.role !== "owner") continue;
    const { count } = await ctx.db.select("workspace_members", {
      eq: { workspace_id: membership.workspace.id, role: "owner" },
      limit: 1,
    });
    if (count <= 1) {
      const { rows: files } = await ctx.db.select("files", { eq: { workspace_id: membership.workspace.id } });
      await ctx.db.remove("workspaces", { eq: { id: membership.workspace.id } });
      if (files.length) await (await backend.storage()).removePrivate(files.map((f) => f.storage_path));
    }
  }
  await backend.auth.deleteUser(ctx.user.id);
}

/** Workspaces that would be deleted along with the account. */
export async function soleOwnedWorkspaces(ctx: WorkspaceContext) {
  const result: string[] = [];
  for (const membership of ctx.memberships) {
    if (membership.role !== "owner") continue;
    const { count } = await ctx.db.select("workspace_members", { eq: { workspace_id: membership.workspace.id, role: "owner" }, limit: 1 });
    if (count <= 1) result.push(membership.workspace.name);
  }
  return result;
}

export async function deleteWorkspace(ctx: WorkspaceContext) {
  const { rows: files } = await ctx.db.select("files", { eq: { workspace_id: ctx.workspace.id } });
  const removed = await ctx.db.remove("workspaces", { eq: { id: ctx.workspace.id } });
  if (!removed) throw new UserFacingError("Only owners can delete a workspace.");
  if (files.length) await (await getBackend().storage()).removePrivate(files.map((f) => f.storage_path));
}
