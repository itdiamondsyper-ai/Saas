"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Check, ChevronsUpDown, LogOut, Plus, Settings, User } from "lucide-react";
import { CreateWorkspaceForm } from "@/components/onboarding/create-workspace-form";
import { Logo } from "@/components/shared/logo";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAction } from "@/hooks/use-action";
import { logoutAction } from "@/lib/actions/auth";
import { switchWorkspaceAction } from "@/lib/actions/workspace";
import { ROLE_LABELS } from "@/lib/permissions";
import { PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { useApp } from "./app-context";
import { NAV_ITEMS, isActive } from "./nav-items";

export function SidebarNav({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Workspace" className="grid gap-0.5">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex h-8 items-center gap-2.5 rounded-md px-2.5 text-sm transition-colors",
              active
                ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} aria-hidden />
            <span className="flex-1 truncate">{item.label}</span>
            {item.href === "/dashboard/notifications" && unread > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-[10px] leading-4 font-semibold text-primary-foreground tabular">
                {unread > 99 ? "99+" : unread}
                <span className="sr-only"> unread</span>
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function WorkspaceSwitcher() {
  const { workspace, workspaces, plan } = useApp();
  const router = useRouter();
  const { run } = useAction();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex w-full items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-left text-sm shadow-xs hover:bg-muted/60"
          aria-label={`Current workspace: ${workspace.name}. Switch workspace`}
        >
          <WorkspaceLogo name={workspace.name} logoUrl={workspace.logoUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{workspace.name}</span>
            <span className="block text-xs text-muted-foreground">{PLANS[plan].name} plan</span>
          </span>
          <ChevronsUpDown className="size-4 text-muted-foreground" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="top" align="start" className="w-60">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
            {workspaces.map((w) => (
              <DropdownMenuItem
                key={w.id}
                onClick={async () => {
                  if (w.id === workspace.id) return;
                  const result = await run(() => switchWorkspaceAction(w.id), { success: `Switched to ${w.name}` });
                  if (result.ok) {
                    router.push("/dashboard");
                    router.refresh();
                  }
                }}
              >
                <WorkspaceLogo name={w.name} logoUrl={w.logoUrl} small />
                <span className="flex-1 truncate">{w.name}</span>
                <span className="text-xs text-muted-foreground">{ROLE_LABELS[w.role]}</span>
                {w.id === workspace.id && <Check className="size-4" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setCreateOpen(true)}>
            <Plus /> Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a workspace</DialogTitle>
            <DialogDescription>Each workspace has its own clients, projects, invoices, team and plan.</DialogDescription>
          </DialogHeader>
          <CreateWorkspaceForm onCreated={() => setCreateOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  );
}

function WorkspaceLogo({ name, logoUrl, small }: { name: string; logoUrl: string | null; small?: boolean }) {
  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo from storage
    <img src={logoUrl} alt="" className={cn("shrink-0 rounded-md object-cover", small ? "size-5" : "size-7")} />
  ) : (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-primary font-semibold text-primary-foreground",
        small ? "size-5 text-[10px]" : "size-7 text-xs",
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AccountMenu({ compact = false }: { compact?: boolean }) {
  const { user } = useApp();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={cn(
          "flex items-center gap-2 rounded-lg text-left text-sm hover:bg-muted/60",
          compact ? "p-1" : "w-full px-2 py-1.5",
        )}
      >
        <UserAvatar name={user.name} src={user.avatarUrl} size="sm" />
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{user.name}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={compact ? "end" : "start"} side={compact ? "bottom" : "top"} className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <span className="block truncate text-foreground">{user.name}</span>
            <span className="block truncate font-normal">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard/settings?tab=profile" />}>
          <User /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
          <Settings /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logoutAction()}>
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Sidebar({ unread, onNavigate }: { unread: number; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-4 bg-sidebar p-3">
      <Link href="/dashboard" onClick={onNavigate} className="flex h-8 items-center px-1.5" aria-label="FlowPilot overview">
        <Logo />
      </Link>
      <div className="flex-1 overflow-y-auto">
        <SidebarNav unread={unread} onNavigate={onNavigate} />
      </div>
      <div className="grid gap-2 border-t pt-3">
        <WorkspaceSwitcher />
        <AccountMenu />
      </div>
    </div>
  );
}
