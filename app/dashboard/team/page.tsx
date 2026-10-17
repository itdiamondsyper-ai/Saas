import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TeamView } from "@/components/team/team-view";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { getTeam } from "@/lib/services/team";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const ctx = await requireWorkspace();
  const team = await getTeam(ctx);
  return (
    <div className="space-y-6">
      <PageHeader title="Team" description={`People with access to ${ctx.workspace.name}.`} />
      <TeamView
        members={team.members.map((m) => ({
          userId: m.userId,
          name: m.name,
          email: m.email,
          role: m.role,
          avatarUrl: m.avatarUrl,
          jobTitle: m.jobTitle,
          lastActiveAt: m.lastActiveAt,
          projects: m.projects,
          openTasks: m.openTasks,
          completedTasks: m.completedTasks,
        }))}
        invitations={team.invitations.map((i) => ({ id: i.id, email: i.email, role: i.role, created_at: i.created_at, expired: i.expired, link: i.link }))}
        seats={{ used: team.seats.used, limit: Number.isFinite(team.seats.limit) ? team.seats.limit : null }}
        currentUserId={ctx.user.id}
        currentRole={ctx.role}
        canManage={can(ctx.role, "team:manage")}
      />
    </div>
  );
}
