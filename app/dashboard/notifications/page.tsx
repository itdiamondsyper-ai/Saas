import type { Metadata } from "next";
import { NotificationsList } from "@/components/notifications/notifications-list";
import { PageHeader } from "@/components/shared/page-header";
import { requireWorkspace } from "@/lib/server/context";
import { listNotifications, unreadCount } from "@/lib/services/notifications";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage({ searchParams }: PageProps<"/dashboard/notifications">) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const filter = sp.filter === "unread" ? "unread" : "all";
  const [{ rows }, unread] = await Promise.all([listNotifications(ctx, filter), unreadCount(ctx)]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Notifications" description="Updates about your invoices, tasks, projects and team." />
      <NotificationsList
        filter={filter}
        unread={unread}
        notifications={rows.map((n) => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read_at: n.read_at, created_at: n.created_at }))}
      />
    </div>
  );
}
