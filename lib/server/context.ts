import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";
import { getBackend, type SessionUser } from "@/lib/backend";
import type { Db } from "@/lib/db/types";
import { can, type Permission } from "@/lib/permissions";
import { effectivePlan } from "@/lib/plans";
import type { PlanTier, ProfileRow, SubscriptionRow, WorkspaceRole, WorkspaceRow } from "@/types/database";
import { ForbiddenError } from "./errors";

export const WORKSPACE_COOKIE = "fp_workspace";

export interface Membership {
  workspace: WorkspaceRow;
  role: WorkspaceRole;
}

export interface WorkspaceContext {
  user: SessionUser;
  profile: ProfileRow;
  workspace: WorkspaceRow;
  role: WorkspaceRole;
  memberships: Membership[];
  subscription: SubscriptionRow | null;
  plan: PlanTier;
  db: Db;
}

/** The authenticated user for this request, validated server-side. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  // Session checks compare timestamps, so they must run at request time, never at prerender.
  await connection();
  return getBackend().auth.getSessionUser();
});

/**
 * Resolves the user's active workspace. The workspace cookie is only a preference:
 * it is honored only if the user is actually a member of that workspace.
 */
export const getWorkspaceContext = cache(async (): Promise<WorkspaceContext | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const db = await getBackend().db();

  const [profile, memberRows] = await Promise.all([
    db.first("profiles", { eq: { id: user.id } }),
    db.select("workspace_members", { eq: { user_id: user.id }, order: [{ column: "created_at" }] }),
  ]);
  if (!profile) return null;

  const workspaceIds = memberRows.rows.map((m) => m.workspace_id);
  const workspaces = workspaceIds.length
    ? (await db.select("workspaces", { in: { id: workspaceIds } })).rows
    : [];
  const memberships: Membership[] = memberRows.rows
    .map((m) => ({ workspace: workspaces.find((w) => w.id === m.workspace_id)!, role: m.role }))
    .filter((m) => m.workspace);
  if (!memberships.length) return null;

  const preferred = (await cookies()).get(WORKSPACE_COOKIE)?.value;
  const active = memberships.find((m) => m.workspace.id === preferred) ?? memberships[0];
  const subscription = await db.first("subscriptions", { eq: { workspace_id: active.workspace.id } });

  return {
    user,
    profile,
    workspace: active.workspace,
    role: active.role,
    memberships,
    subscription,
    plan: effectivePlan(subscription),
    db,
  };
});

/** For pages: redirects to login or onboarding instead of rendering without access. */
export async function requireWorkspace(options: { allowIncompleteOnboarding?: boolean } = {}): Promise<WorkspaceContext> {
  const ctx = await getWorkspaceContext();
  if (!ctx) redirect((await getSessionUser()) ? "/onboarding" : "/login");
  if (!options.allowIncompleteOnboarding && !ctx.workspace.onboarding_completed && ctx.role === "owner") {
    redirect("/onboarding");
  }
  return ctx;
}

export function assertCan(ctx: WorkspaceContext, permission: Permission) {
  if (!can(ctx.role, permission)) {
    throw new ForbiddenError("You don't have permission to do that in this workspace.");
  }
}
