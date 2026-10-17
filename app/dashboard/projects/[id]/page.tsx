import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FileText } from "lucide-react";
import { BreadcrumbLabel } from "@/components/app/app-context";
import { ExpensesPanel, ProjectHeaderActions, ProjectTabs, ProjectTaskList } from "@/components/projects/project-detail-client";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { AtRiskBadge, InvoiceStatusBadge, PriorityLabel, ProjectStatusBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/empty-state";
import { FilesPanel } from "@/components/shared/files-panel";
import { Panel } from "@/components/shared/panel";
import { UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { daysBetween, todayString } from "@/lib/dates";
import { formatCurrency, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { clientOptions } from "@/lib/services/clients";
import { listMembers } from "@/lib/services/members";
import { getProjectDetail, projectOptions } from "@/lib/services/projects";
import { listTasks } from "@/lib/services/tasks";
import { cn } from "@/lib/utils";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Project" };

export default async function ProjectDetailPage({ params }: PageProps<"/dashboard/projects/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const ctx = await requireWorkspace();
  const detail = await getProjectDetail(ctx, id);
  if (!detail) notFound();
  const [clients, members, projects, tasks] = await Promise.all([
    clientOptions(ctx),
    listMembers(ctx),
    projectOptions(ctx),
    listTasks(ctx, { projectId: id }),
  ]);
  const { project, financials } = detail;
  const canWrite = can(ctx.role, "records:write");
  const memberOptions = members.map((m) => ({ id: m.userId, label: m.name }));
  const projectOpts = projects.map((p) => ({ id: p.id, label: p.label }));

  const today = todayString();
  const totalDays = project.start_date && project.due_date ? Math.max(daysBetween(project.start_date, project.due_date), 1) : null;
  const elapsed = project.start_date ? Math.min(Math.max(daysBetween(project.start_date, today), 0), totalDays ?? 0) : 0;
  const daysLeft = project.due_date ? daysBetween(today, project.due_date) : null;
  const timePct = totalDays ? Math.round((elapsed / totalDays) * 100) : 0;
  const billedPct = financials.budget ? Math.min(Math.round((financials.billed / financials.budget) * 100), 100) : 0;

  const overview = (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Panel title="About this project">
          <p className="text-sm whitespace-pre-wrap text-muted-foreground">{project.description || "No description yet."}</p>
        </Panel>
        <Panel title="Timeline">
          {project.start_date && project.due_date ? (
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span>
                  <span className="block text-xs text-muted-foreground">Start</span>
                  {formatDate(project.start_date, "long")}
                </span>
                <span className="text-right">
                  <span className="block text-xs text-muted-foreground">Due</span>
                  {formatDate(project.due_date, "long")}
                </span>
              </div>
              <div className="relative h-2 rounded-full bg-muted" role="img" aria-label={`${timePct}% of the timeline has elapsed and the work is ${project.progress}% complete`}>
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary/25" style={{ width: `${timePct}%` }} />
                <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${project.progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {timePct}% of time elapsed · {project.progress}% of work complete ·{" "}
                {daysLeft === null ? "" : daysLeft < 0 ? `${-daysLeft} days overdue` : `${daysLeft} days left`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Add start and due dates to see the timeline.</p>
          )}
        </Panel>
        <Panel title="Recent activity">
          <ActivityFeed items={detail.activity.slice(0, 8)} />
        </Panel>
      </div>
      <div className="space-y-4">
        <Panel title="Details">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Client</dt>
              <dd className="text-right">
                {detail.client ? (
                  <Link href={`/dashboard/clients/${detail.client.id}`} className="text-primary hover:underline">
                    {detail.client.company}
                  </Link>
                ) : (
                  "Internal"
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Owner</dt>
              <dd className="flex items-center gap-1.5">
                {detail.owner ? (
                  <>
                    <UserAvatar name={detail.owner.name} src={detail.owner.avatarUrl} size="sm" /> {detail.owner.name}
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Priority</dt>
              <dd>
                <PriorityLabel priority={project.priority} className="text-sm" />
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Budget</dt>
              <dd className="tabular">{formatCurrency(financials.budget)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Amount billed</dt>
              <dd className="tabular">{formatCurrency(financials.billed)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted-foreground">Outstanding</dt>
              <dd className="tabular">{formatCurrency(financials.outstanding, "USD", { cents: true })}</dd>
            </div>
          </dl>
        </Panel>
        <Panel title={`Members (${detail.members.length})`}>
          {detail.members.length ? (
            <ul className="space-y-2.5">
              {detail.members.map((m) => (
                <li key={m.userId} className="flex items-center gap-2.5 text-sm">
                  <UserAvatar name={m.name} src={m.avatarUrl} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{m.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{m.jobTitle ?? m.email}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No members assigned.</p>
          )}
        </Panel>
      </div>
    </div>
  );

  const financialsTab = (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Money label="Budget" value={financials.budget} />
        <Money label="Billed" value={financials.billed} hint={`${billedPct}% of budget`} />
        <Money label="Outstanding" value={financials.outstanding} />
        <Money label="Profit (paid − costs)" value={financials.profit} tone={financials.profit >= 0 ? "good" : "bad"} hint={`Costs ${formatCurrency(financials.costs)}`} />
      </div>
      <Panel title="Budget used">
        <Progress value={billedPct} aria-label={`${billedPct}% of budget billed`} />
        <p className="mt-2 text-xs text-muted-foreground">
          {formatCurrency(Math.max(financials.remainingBudget, 0))} of budget remaining to bill
          {financials.remainingBudget < 0 ? ` · over budget by ${formatCurrency(-financials.remainingBudget)}` : ""}
        </p>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Invoices"
          action={
            canWrite &&
            detail.client && (
              <Link href={`/dashboard/invoices/new?client=${detail.client.id}&project=${project.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                New invoice
              </Link>
            )
          }
          bodyClassName="px-2 sm:px-3"
        >
          {detail.invoices.length ? (
            <ul className="divide-y">
              {detail.invoices.map((inv) => (
                <li key={inv.id}>
                  <Link href={`/dashboard/invoices/${inv.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                    <FileText className="size-4 text-muted-foreground" />
                    <span className="flex-1 text-sm font-medium">{inv.number}</span>
                    <span className="text-sm tabular">{formatCurrency(Number(inv.total), "USD", { cents: true })}</span>
                    <InvoiceStatusBadge status={inv.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={FileText} title="No invoices for this project" compact />
          )}
        </Panel>
        <Panel>
          <ExpensesPanel projectId={project.id} expenses={detail.expenses} canWrite={canWrite} canDelete={can(ctx.role, "records:delete")} />
        </Panel>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <BreadcrumbLabel label={project.name} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{project.name}</h1>
            <ProjectStatusBadge status={project.status} />
            {detail.atRisk && <AtRiskBadge />}
          </div>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            {detail.client && <span>{detail.client.company}</span>}
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" /> Due {formatDate(project.due_date, "long")}
            </span>
          </p>
          <div className="flex items-center gap-2 pt-1">
            <Progress value={project.progress} className="w-40" aria-label={`${project.progress}% complete`} />
            <span className="text-sm font-medium tabular">{project.progress}%</span>
          </div>
        </div>
        <div className="flex gap-2">
          <ProjectHeaderActions
            project={project}
            memberIds={detail.members.map((m) => m.userId)}
            clients={clients}
            members={memberOptions}
            hasTasks={detail.tasks.length > 0}
            canWrite={canWrite}
            canDelete={can(ctx.role, "records:delete")}
            currentUserId={ctx.user.id}
          />
        </div>
      </div>

      <ProjectTabs
        panels={[
          { value: "overview", label: "Overview", content: overview },
          {
            value: "tasks",
            label: `Tasks (${tasks.length})`,
            content: (
              <ProjectTaskList
                projectId={project.id}
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
                projects={projectOpts}
                members={memberOptions}
                canWrite={canWrite}
                canDelete={can(ctx.role, "tasks:delete")}
                currentUserId={ctx.user.id}
              />
            ),
          },
          { value: "files", label: `Files (${detail.files.length})`, content: <Panel><FilesPanel files={detail.files} projectId={project.id} canWrite={canWrite} /></Panel> },
          { value: "activity", label: "Activity", content: <Panel><ActivityFeed items={detail.activity} /></Panel> },
          { value: "financials", label: "Financials", content: financialsTab },
        ]}
      />
    </div>
  );
}

function Money({ label, value, hint, tone }: { label: string; value: number; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tracking-tight tabular", tone === "good" && "text-success", tone === "bad" && "text-destructive")}>
        {formatCurrency(value, "USD", { cents: value % 1 !== 0 })}
      </p>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
