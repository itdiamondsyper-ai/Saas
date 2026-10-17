import type { Metadata } from "next";
import { ClientsTable } from "@/components/clients/clients-table";
import { PageHeader } from "@/components/shared/page-header";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { listClients, type ClientSort } from "@/lib/services/clients";
import type { ClientStatus } from "@/types/database";

export const metadata: Metadata = { title: "Clients" };

const SORTS: ClientSort[] = ["company", "contact_name", "status", "revenue", "projects", "last_activity_at", "created_at"];
const STATUSES = ["lead", "active", "inactive", "archived", "all"];

export default async function ClientsPage({ searchParams }: PageProps<"/dashboard/clients">) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const sort = SORTS.includes(str("sort") as ClientSort) ? (str("sort") as ClientSort) : "company";
  const status = STATUSES.includes(str("status") ?? "") ? (str("status") as ClientStatus | "all") : undefined;
  const result = await listClients(ctx, {
    q: str("q"),
    status,
    sort,
    dir: str("dir") === "desc" ? "desc" : "asc",
    page: Number(str("page") ?? 1) || 1,
    pageSize: 10,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Clients" description="Everyone you work with, from first conversation to repeat business." />
      <ClientsTable
        {...result}
        canWrite={can(ctx.role, "records:write")}
        canDelete={can(ctx.role, "records:delete")}
        openNew={str("new") === "1"}
      />
    </div>
  );
}
