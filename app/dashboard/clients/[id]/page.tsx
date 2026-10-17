import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, FolderKanban, Globe, Mail, MapPin, Phone, Plus } from "lucide-react";
import { BreadcrumbLabel } from "@/components/app/app-context";
import { ClientHeaderActions } from "@/components/clients/client-header-actions";
import { ClientStatusBadge, InvoiceStatusBadge, ProjectStatusBadge } from "@/components/shared/badges";
import { ActivityFeed } from "@/components/shared/activity-feed";
import { EmptyState } from "@/components/shared/empty-state";
import { FilesPanel } from "@/components/shared/files-panel";
import { Panel } from "@/components/shared/panel";
import { CompanyAvatar, UserAvatar } from "@/components/shared/user-avatar";
import { buttonVariants } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate } from "@/lib/format";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { getClientDetail } from "@/lib/services/clients";
import { uuid } from "@/lib/validation/common";

export const metadata: Metadata = { title: "Client" };

export default async function ClientDetailPage({ params }: PageProps<"/dashboard/clients/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) notFound();
  const ctx = await requireWorkspace();
  const detail = await getClientDetail(ctx, id);
  if (!detail) notFound();
  const { client } = detail;
  const canWrite = can(ctx.role, "records:write");
  const activeProjects = detail.projects.filter((p) => ["planning", "active", "in_review"].includes(p.status));

  return (
    <div className="space-y-6">
      <BreadcrumbLabel label={client.company} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <CompanyAvatar name={client.company} className="size-12 text-sm" />
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{client.company}</h1>
              <ClientStatusBadge status={client.status} />
            </div>
            <p className="text-sm text-muted-foreground">
              {client.contact_name}
              {client.industry ? ` · ${client.industry}` : ""} · Client since {formatDate(client.created_at, "long")}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <ClientHeaderActions client={client} canWrite={canWrite} canDelete={can(ctx.role, "records:delete")} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Lifetime revenue" value={formatCurrency(detail.lifetimeRevenue)} />
        <Stat label="Outstanding" value={formatCurrency(detail.outstandingAmount, "USD", { cents: true })} />
        <Stat label="Active projects" value={String(activeProjects.length)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Projects"
            action={
              canWrite && (
                <Link href={`/dashboard/projects?new=1&client=${client.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Plus /> New project
                </Link>
              )
            }
            bodyClassName="px-2 sm:px-3"
          >
            {detail.projects.length ? (
              <ul className="divide-y">
                {detail.projects.map((p) => (
                  <li key={p.id}>
                    <Link href={`/dashboard/projects/${p.id}`} className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-muted/50">
                      <FolderKanban className="size-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.name}</p>
                        <div className="mt-1.5 flex items-center gap-2">
                          <Progress value={p.progress} className="w-24" aria-label={`${p.progress}% complete`} />
                          <span className="text-xs text-muted-foreground tabular">{p.progress}%</span>
                        </div>
                      </div>
                      <span className="hidden text-xs text-muted-foreground sm:block">Due {formatDate(p.due_date)}</span>
                      <ProjectStatusBadge status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={FolderKanban} title="No projects yet" compact />
            )}
          </Panel>

          <Panel
            title="Invoices"
            action={
              canWrite && (
                <Link href={`/dashboard/invoices/new?client=${client.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <Plus /> New invoice
                </Link>
              )
            }
            bodyClassName="px-2 sm:px-3"
          >
            {detail.invoices.length ? (
              <ul className="divide-y">
                {detail.invoices.slice(0, 8).map((inv) => (
                  <li key={inv.id}>
                    <Link href={`/dashboard/invoices/${inv.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 hover:bg-muted/50">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-sm font-medium">{inv.number}</span>
                      <span className="hidden text-xs text-muted-foreground sm:block">{formatDate(inv.issue_date)}</span>
                      <span className="w-24 text-right text-sm tabular">{formatCurrency(Number(inv.total), "USD", { cents: true })}</span>
                      <InvoiceStatusBadge status={inv.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={FileText} title="No invoices yet" compact />
            )}
            {detail.invoices.length > 8 && (
              <Link href={`/dashboard/invoices?client=${client.id}`} className="mt-2 block px-2 text-sm font-medium text-primary hover:underline">
                View all {detail.invoices.length} invoices
              </Link>
            )}
          </Panel>

          <Panel title="Files">
            <FilesPanel files={detail.files} clientId={client.id} canWrite={canWrite} />
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Contact">
            <dl className="space-y-3 text-sm">
              <InfoRow icon={Mail} label="Email">
                {client.email ? (
                  <a href={`mailto:${client.email}`} className="text-primary hover:underline">
                    {client.email}
                  </a>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow icon={Phone} label="Phone">
                {client.phone ? <a href={`tel:${client.phone}`}>{client.phone}</a> : "—"}
              </InfoRow>
              <InfoRow icon={Globe} label="Website">
                {client.website ? (
                  <a href={client.website} target="_blank" rel="noopener noreferrer nofollow" className="text-primary hover:underline">
                    {client.website.replace(/^https?:\/\//, "")}
                  </a>
                ) : (
                  "—"
                )}
              </InfoRow>
              <InfoRow icon={MapPin} label="Address">
                {client.address ?? "—"}
              </InfoRow>
            </dl>
          </Panel>
          <Panel title="Company">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Industry</dt>
                <dd>{client.industry ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Account owner</dt>
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
              <div className="col-span-2">
                <dt className="text-xs text-muted-foreground">Tags</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {client.tags.length
                    ? client.tags.map((t) => (
                        <span key={t} className="rounded-md bg-muted px-2 py-0.5 text-xs">
                          {t}
                        </span>
                      ))
                    : "—"}
                </dd>
              </div>
            </dl>
          </Panel>
          <Panel title="Notes">
            <p className="text-sm whitespace-pre-wrap text-muted-foreground">{client.notes || "No notes yet."}</p>
          </Panel>
          <Panel title="Recent activity">
            <ActivityFeed items={detail.activity} />
          </Panel>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular">{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, children }: { icon: typeof Mail; label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="break-words">{children}</dd>
      </div>
    </div>
  );
}
