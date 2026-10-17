import "server-only";
import type { WorkspaceContext } from "@/lib/server/context";
import type { NotificationPrefs } from "@/types/database";

export type NotificationCategory = keyof Pick<NotificationPrefs, "tasks" | "invoices">;

interface NotificationInput {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
}

/**
 * Sends in-app notifications to workspace members. The actor never notifies
 * themselves, and recipients who turned a category off are skipped.
 */
export async function notify(
  ctx: WorkspaceContext,
  recipientIds: (string | null | undefined)[],
  input: NotificationInput,
  category?: NotificationCategory,
) {
  const ids = Array.from(new Set(recipientIds.filter((id): id is string => !!id && id !== ctx.user.id)));
  if (!ids.length) return;
  try {
    const { rows: members } = await ctx.db.select("workspace_members", {
      eq: { workspace_id: ctx.workspace.id },
      in: { user_id: ids },
    });
    const { rows: profiles } = await ctx.db.select("profiles", { in: { id: members.map((m) => m.user_id) } });
    const recipients = profiles.filter((p) => !category || p.notification_prefs?.[category] !== false);
    if (!recipients.length) return;
    await ctx.db.insertMany(
      "notifications",
      recipients.map((p) => ({
        workspace_id: ctx.workspace.id,
        user_id: p.id,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        read_at: null,
      })),
    );
  } catch (error) {
    console.error("[notifications] failed to send", input.type, error);
  }
}

/** Owners and admins of the workspace, used for business events like payments. */
export async function adminIds(ctx: WorkspaceContext): Promise<string[]> {
  const { rows } = await ctx.db.select("workspace_members", {
    eq: { workspace_id: ctx.workspace.id },
    in: { role: ["owner", "admin"] },
  });
  return rows.map((r) => r.user_id);
}

export async function listNotifications(ctx: WorkspaceContext, filter: "all" | "unread" = "all", limit = 100) {
  const { rows, count } = await ctx.db.select("notifications", {
    eq: { workspace_id: ctx.workspace.id, user_id: ctx.user.id, ...(filter === "unread" ? { read_at: null } : {}) },
    order: [{ column: "created_at", ascending: false }],
    limit,
  });
  return { rows, total: count };
}

export async function unreadCount(ctx: WorkspaceContext): Promise<number> {
  const { count } = await ctx.db.select("notifications", {
    eq: { workspace_id: ctx.workspace.id, user_id: ctx.user.id, read_at: null },
    limit: 1,
  });
  return count;
}

export async function markRead(ctx: WorkspaceContext, ids: string[] | "all") {
  const now = new Date().toISOString();
  await ctx.db.update(
    "notifications",
    {
      eq: { workspace_id: ctx.workspace.id, user_id: ctx.user.id, read_at: null },
      ...(ids === "all" ? {} : { in: { id: ids } }),
    },
    { read_at: now },
  );
}

export async function markUnread(ctx: WorkspaceContext, id: string) {
  await ctx.db.update("notifications", { eq: { id, workspace_id: ctx.workspace.id, user_id: ctx.user.id } }, { read_at: null });
}

export async function deleteNotification(ctx: WorkspaceContext, id: string) {
  await ctx.db.remove("notifications", { eq: { id, workspace_id: ctx.workspace.id, user_id: ctx.user.id } });
}
