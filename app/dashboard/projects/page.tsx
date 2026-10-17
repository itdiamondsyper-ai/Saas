import type { Metadata } from "next";
import { ProjectsView } from "@/components/projects/projects-view";
import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { clientOptions } from "@/lib/services/clients";
import { listMembers } from "@/lib/services/members";
import { listProjects } from "@/lib/services/projects";
import { uuid } from "@/lib/validation/common";
import type { ProjectStatus } from "@/types/database";

export const metadata: Metadata = { title: "Projects" };

const STATUSES: ProjectStatus[] = ["planning", "active", "in_review", "completed", "on_hold"];

export default async function ProjectsPage({ searchParams }: PageProps<"/dashboard/projects">) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const status = STATUSES.includes(str("status") as ProjectStatus) ? (str("status") as ProjectStatus) : undefined;
  const clientId = uuid.safeParse(str("client")).success ? str("client") : undefined;
  const [projects, clients, members] = await Promise.all([
    listProjects(ctx, { q: str("q"), status, clientId }),
    clientOptions(ctx),
    listMembers(ctx),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Projects" description="Plan, track and deliver client work." />
      <ProjectsView
        projects={projects.map((p) => ({
          id: p.id,
          name: p.name,
          status: p.status,
          priority: p.priority,
          progress: p.progress,
          budget: Number(p.budget),
          due_date: p.due_date,
          start_date: p.start_date,
          atRisk: p.atRisk,
          openTaskCount: p.openTaskCount,
          taskCount: p.taskCount,
          client: p.client ? { id: p.client.id, company: p.client.company } : null,
          owner: p.owner,
          members: p.members,
        }))}
        clients={clients}
        members={members.map((m) => ({ id: m.userId, label: m.name }))}
        canWrite={can(ctx.role, "records:write")}
        openNew={str("new") === "1"}
        defaultClientId={clientId}
        currentUserId={ctx.user.id}
      />
    </div>
  );
}
