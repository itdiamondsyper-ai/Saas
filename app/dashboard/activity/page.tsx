import type { Metadata } from "next";
import Link from "next/link";
import { Activity, Download } from "lucide-react";
import { ActivityFilters } from "@/components/activity/activity-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { requireWorkspace } from "@/lib/server/context";
import { listActivity } from "@/lib/services/activity";
import { listMembers } from "@/lib/services/members";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Activity" };

const PAGE_SIZE = 30;
const TYPES = ["client", "project", "task", "invoice", "member", "workspace", "file"];

export default async function ActivityPage({ searchParams }: PageProps<"/dashboard/activity">) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const page = Math.max(1, Number(str("page") ?? 1) || 1);
  const [{ items, total }, members] = await Promise.all([
    listActivity(ctx, {
      q: str("q"),
      entityType: TYPES.includes(str("type") ?? "") ? str("type") : undefined,
      actorId: uuid.safeParse(str("user")).success ? str("user") : undefined,
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    listMembers(ctx),
  ]);
  const canExport = PLANS[ctx.plan].highlights.auditLogs && (ctx.role === "owner" || ctx.role === "admin");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity"
        description="An audit trail of important changes in your workspace."
        actions={
          canExport ? (
            <a href="/api/activity/export" className={buttonVariants({ variant: "outline" })}>
              <Download /> Export CSV
            </a>
          ) : (
            <Link href="/dashboard/settings?tab=billing" className="text-xs text-muted-foreground hover:text-foreground">
              Audit log export is available on Business
            </Link>
          )
        }
      />
      <ActivityFilters members={members.map((m) => ({ id: m.userId, label: m.name }))} total={total} page={page} pageSize={PAGE_SIZE} />
      {items.length === 0 ? (
        <EmptyState icon={Activity} title="No activity found" description="Changes to clients, projects, tasks, invoices and the team appear here." />
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-medium">User</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Event</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Affected</th>
                <th scope="col" className="px-4 py-2.5 font-medium">When</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <UserAvatar name={a.actor?.name ?? "Former member"} src={a.actor?.avatarUrl} size="sm" />
                      <span className="truncate">{a.actor?.name ?? "Former member"}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">{a.sentence}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted-foreground capitalize">{a.entityType}</span>
                    <span className="block">
                      {a.href ? (
                        <Link href={a.href} className="text-primary hover:underline">
                          {a.entityName}
                        </Link>
                      ) : (
                        a.entityName
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    <time dateTime={a.createdAt}>{formatDateTime(a.createdAt)}</time>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
