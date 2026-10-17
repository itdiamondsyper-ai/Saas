import "server-only";
import { UserFacingError } from "@/lib/backend/types";
import type { WorkspaceContext } from "@/lib/server/context";
import type { ProfileRow, WorkspaceRole } from "@/types/database";

export interface MemberSummary {
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  lastActiveAt: string | null;
  profile: ProfileRow;
}

/** Members of the active workspace with their profiles, ordered by role then name. */
export async function listMembers(ctx: WorkspaceContext): Promise<MemberSummary[]> {
  const { rows: memberRows } = await ctx.db.select("workspace_members", { eq: { workspace_id: ctx.workspace.id } });
  if (!memberRows.length) return [];
  const { rows: profiles } = await ctx.db.select("profiles", { in: { id: memberRows.map((m) => m.user_id) } });
  const rank: Record<WorkspaceRole, number> = { owner: 0, admin: 1, member: 2, viewer: 3 };
  return memberRows
    .map((m) => {
      const profile = profiles.find((p) => p.id === m.user_id);
      if (!profile) return null;
      return {
        userId: m.user_id,
        role: m.role,
        joinedAt: m.created_at,
        name: profile.full_name || profile.email,
        email: profile.email,
        avatarUrl: profile.avatar_url,
        jobTitle: profile.job_title,
        lastActiveAt: profile.last_active_at,
        profile,
      } satisfies MemberSummary;
    })
    .filter((m): m is MemberSummary => m !== null)
    .sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));
}

export async function memberMap(ctx: WorkspaceContext): Promise<Map<string, MemberSummary>> {
  return new Map((await listMembers(ctx)).map((m) => [m.userId, m]));
}

/** Ensures a user id supplied by the client belongs to this workspace. */
export async function assertMember(ctx: WorkspaceContext, userId: string | null) {
  if (!userId) return;
  const row = await ctx.db.first("workspace_members", { eq: { workspace_id: ctx.workspace.id, user_id: userId } });
  if (!row) throw new UserFacingError("That person isn't a member of this workspace.");
}

export interface PersonRef {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export function personRef(member: MemberSummary | undefined): PersonRef | null {
  return member ? { id: member.userId, name: member.name, avatarUrl: member.avatarUrl } : null;
}
