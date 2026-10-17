import type { Metadata } from "next";
import { Suspense } from "react";
import { AppFrame } from "@/components/app/app-frame";
import { AppShellSkeleton } from "@/components/app/app-shell-skeleton";
import { isDemoMode } from "@/lib/env";
import { requireWorkspace } from "@/lib/server/context";
import { listNotifications, unreadCount } from "@/lib/services/notifications";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · FlowPilot" } };

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <Suspense fallback={<AppShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

async function AppShell({ children }: { children: React.ReactNode }) {
  const ctx = await requireWorkspace();
  const [unread, recent] = await Promise.all([unreadCount(ctx), listNotifications(ctx, "all", 6)]);
  return (
    <AppFrame
      value={{
        user: {
          id: ctx.user.id,
          name: ctx.profile.full_name || ctx.profile.email,
          email: ctx.profile.email,
          avatarUrl: ctx.profile.avatar_url,
        },
        workspace: { id: ctx.workspace.id, name: ctx.workspace.name, logoUrl: ctx.workspace.logo_url, role: ctx.role },
        workspaces: ctx.memberships.map((m) => ({ id: m.workspace.id, name: m.workspace.name, logoUrl: m.workspace.logo_url, role: m.role })),
        plan: ctx.plan,
        demoMode: isDemoMode(),
      }}
      unread={unread}
      notifications={recent.rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        link: n.link,
        readAt: n.read_at,
        createdAt: n.created_at,
      }))}
    >
      {children}
    </AppFrame>
  );
}
