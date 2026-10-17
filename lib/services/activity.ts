import "server-only";
import { describeActivity, entityHref } from "@/lib/activity-format";
import type { WorkspaceContext } from "@/lib/server/context";
import type { ActivityLogRow } from "@/types/database";
import { memberMap, personRef, type PersonRef } from "./members";

export async function logActivity(
  ctx: WorkspaceContext,
  action: string,
  entity: { type: string; id: string | null; name: string | null },
  metadata: Record<string, unknown> = {},
) {
  try {
    await ctx.db.insert("activity_logs", {
      workspace_id: ctx.workspace.id,
      actor_id: ctx.user.id,
      action,
      entity_type: entity.type,
      entity_id: entity.id,
      entity_name: entity.name,
      metadata,
    });
  } catch (error) {
    // Activity is an audit trail, but failing to record it must not undo the user's change.
    console.error("[activity] failed to record", action, error);
  }
}

export interface ActivityItem {
  id: string;
  actor: PersonRef | null;
  action: string;
  entityType: string;
  entityName: string | null;
  href: string | null;
  sentence: string;
  createdAt: string;
}

function toItems(rows: ActivityLogRow[], people: Awaited<ReturnType<typeof memberMap>>): ActivityItem[] {
  return rows.map((row) => {
    const actor = personRef(row.actor_id ? people.get(row.actor_id) : undefined);
    const { withActor, text } = describeActivity(row.action, row.entity_name, row.metadata);
    const actorName = actor?.name.split(" ")[0] ?? "Someone";
    return {
      id: row.id,
      actor,
      action: row.action,
      entityType: row.entity_type,
      entityName: row.entity_name,
      href: entityHref(row.entity_type, row.entity_id),
      sentence: withActor ? `${actorName} ${text}` : text,
      createdAt: row.created_at,
    };
  });
}

export interface ActivityQuery {
  entityType?: string;
  actorId?: string;
  entityIds?: string[];
  q?: string;
  limit?: number;
  offset?: number;
}

export async function listActivity(ctx: WorkspaceContext, query: ActivityQuery = {}) {
  const { rows, count } = await ctx.db.select("activity_logs", {
    eq: {
      workspace_id: ctx.workspace.id,
      ...(query.entityType ? { entity_type: query.entityType } : {}),
      ...(query.actorId ? { actor_id: query.actorId } : {}),
    },
    ...(query.entityIds ? { in: { entity_id: query.entityIds } } : {}),
    ...(query.q ? { search: { columns: ["entity_name", "action"], term: query.q } } : {}),
    order: [{ column: "created_at", ascending: false }],
    limit: query.limit ?? 50,
    offset: query.offset ?? 0,
  });
  return { items: toItems(rows, await memberMap(ctx)), total: count };
}
