import { NextResponse } from "next/server";
import { PLANS } from "@/lib/plans";
import { getWorkspaceContext } from "@/lib/server/context";
import { listActivity } from "@/lib/services/activity";

function csvCell(value: string) {
  // Neutralize spreadsheet formula injection and escape quotes.
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Business plan: export the workspace audit log as CSV (owners and admins only). */
export async function GET() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!(ctx.role === "owner" || ctx.role === "admin")) return NextResponse.json({ error: "Only owners and admins can export the audit log." }, { status: 403 });
  if (!PLANS[ctx.plan].highlights.auditLogs) return NextResponse.json({ error: "Audit log export requires the Business plan." }, { status: 402 });

  const { items } = await listActivity(ctx, { limit: 5000 });
  const rows = [
    ["timestamp", "user", "event", "entity_type", "entity"].join(","),
    ...items.map((a) => [a.createdAt, a.actor?.name ?? "", a.sentence, a.entityType, a.entityName ?? ""].map(csvCell).join(",")),
  ];
  return new NextResponse(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="flowpilot-audit-log.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
