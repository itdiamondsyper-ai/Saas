"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, CircleDollarSign, Clock, FolderKanban, MailOpen, Trash2, UserPlus, Users, type LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { deleteNotificationAction, markNotificationUnreadAction, markNotificationsReadAction } from "@/lib/actions/account";
import { formatRelative } from "@/lib/format";
import { useQueryState } from "@/hooks/use-query-state";
import { cn } from "@/lib/utils";

export interface NotificationData {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

const ICONS: Record<string, LucideIcon> = {
  invoice_paid: CircleDollarSign,
  task_assigned: UserPlus,
  task_overdue: Clock,
  task_comment: MailOpen,
  project_deadline: FolderKanban,
  project_added: FolderKanban,
  member_invited: Users,
  client_added: Users,
};

export function NotificationsList({ notifications, unread, filter }: { notifications: NotificationData[]; unread: number; filter: "all" | "unread" }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const { set } = useQueryState();
  const act = async (fn: () => ReturnType<typeof markNotificationsReadAction>, success?: string) => {
    const r = await run(fn, { success });
    if (r.ok) router.refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Filter notifications" className="flex rounded-lg border bg-card p-0.5">
          {(["all", "unread"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              onClick={() => set({ filter: f === "all" ? null : f })}
              className={cn("rounded-md px-3 py-1 text-sm text-muted-foreground", filter === f && "bg-muted font-medium text-foreground")}
            >
              {f === "all" ? "All" : `Unread (${unread})`}
            </button>
          ))}
        </div>
        <Button variant="outline" disabled={unread === 0 || pending} onClick={() => act(() => markNotificationsReadAction({ ids: "all" }), "All notifications marked as read")}>
          <CheckCheck /> Mark all as read
        </Button>
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={Bell} title={filter === "unread" ? "No unread notifications" : "No notifications yet"} description="We'll let you know when invoices are paid, tasks are assigned or deadlines are close." />
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li key={n.id} className={cn("group flex gap-3 px-4 py-3.5", !n.read_at && "bg-primary/[0.03]")} data-testid="notification">
                <span className={cn("mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full", n.read_at ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary")}>
                  <Icon className="size-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", !n.read_at && "font-medium")}>
                    {!n.read_at && <span className="sr-only">Unread: </span>}
                    {n.link ? (
                      <Link
                        href={n.link}
                        className="hover:underline"
                        onClick={() => {
                          if (!n.read_at) void markNotificationsReadAction({ ids: [n.id] });
                        }}
                      >
                        {n.title}
                      </Link>
                    ) : (
                      n.title
                    )}
                  </p>
                  {n.body && <p className="text-sm text-muted-foreground">{n.body}</p>}
                  <p className="mt-0.5 text-xs text-muted-foreground">{formatRelative(n.created_at)}</p>
                </div>
                <div className="flex items-start gap-1">
                  {n.read_at ? (
                    <Button variant="ghost" size="sm" onClick={() => act(() => markNotificationUnreadAction({ id: n.id }))}>
                      Mark unread
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => act(() => markNotificationsReadAction({ ids: [n.id] }))}>
                      Mark as read
                    </Button>
                  )}
                  <Button variant="ghost" size="icon-sm" aria-label="Delete notification" onClick={() => act(() => deleteNotificationAction({ id: n.id }))}>
                    <Trash2 />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
