import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { TasksView } from "@/components/tasks/tasks-view";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { listMembers } from "@/lib/services/members";
import { projectOptions } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";
import { uuid } from "@/lib/validation/common";
import type { Priority } from "@/types/database";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: PageProps<"/dashboard/tasks">) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const id = (k: string) => (uuid.safeParse(str(k)).success ? str(k) : undefined);
  const priority = ["low", "medium", "high", "urgent"].includes(str("priority") ?? "") ? (str("priority") as Priority) : undefined;
  const due = str("due") === "overdue" || str("due") === "week" ? (str("due") as "overdue" | "week") : undefined;

  const [tasks, allTasks, projects, members] = await Promise.all([
    listTasks(ctx, {
      q: str("q"),
      projectId: id("project"),
      assigneeId: str("assignee") === "unassigned" ? "unassigned" : id("assignee"),
      priority,
      label: str("label"),
      due,
    }),
    listTasks(ctx),
    projectOptions(ctx),
    listMembers(ctx),
  ]);
  const labels = Array.from(new Set(allTasks.flatMap((t) => t.labels))).sort();

  return (
    <div className="space-y-6">
      <PageHeader title="Tasks" description="Everything your team is working on, across every project." />
      <TasksView
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          due_date: t.due_date,
          labels: t.labels,
          position: t.position,
          project: t.project,
          assignee: t.assignee,
          commentCount: t.commentCount,
        }))}
        projects={projects.map((p) => ({ id: p.id, label: p.label }))}
        members={members.map((m) => ({ id: m.userId, label: m.name }))}
        labels={labels}
        canWrite={can(ctx.role, "records:write")}
        canDelete={can(ctx.role, "tasks:delete")}
        currentUserId={ctx.user.id}
        openNew={str("new") === "1"}
      />
    </div>
  );
}
