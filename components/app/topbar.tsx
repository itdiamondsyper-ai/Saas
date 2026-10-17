"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Fragment } from "react";
import { Bell, BookOpen, CircleHelp, Keyboard, LifeBuoy, Menu, Search } from "lucide-react";
import { Kbd } from "@/components/shared/kbd";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markNotificationsReadAction } from "@/lib/actions/account";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBreadcrumbLabel } from "./app-context";
import { NAV_ITEMS } from "./nav-items";
import { AccountMenu } from "./sidebar";

export interface BellNotification {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

const EXTRA_LABELS: Record<string, string> = { new: "New", edit: "Edit" };

function useCrumbs() {
  const pathname = usePathname();
  const detailLabel = useBreadcrumbLabel();
  const parts = pathname.split("/").filter(Boolean).slice(1);
  const crumbs: { href: string; label: string }[] = [{ href: "/dashboard", label: "Overview" }];
  let href = "/dashboard";
  parts.forEach((part, i) => {
    href += `/${part}`;
    const nav = NAV_ITEMS.find((n) => n.href === href);
    const isLast = i === parts.length - 1;
    const label = nav?.label ?? EXTRA_LABELS[part] ?? (isLast || parts[i + 1] === "edit" ? detailLabel ?? "Details" : "Details");
    crumbs.push({ href, label });
  });
  return crumbs.length > 1 ? crumbs.slice(1) : crumbs;
}

export function Topbar({
  onOpenMenu,
  onOpenSearch,
  unread,
  notifications,
}: {
  onOpenMenu: () => void;
  onOpenSearch: () => void;
  unread: number;
  notifications: BellNotification[];
}) {
  const crumbs = useCrumbs();
  return (
    <header className="no-print sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur supports-backdrop-filter:bg-background/70 sm:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenMenu} aria-label="Open navigation">
        <Menu />
      </Button>
      <Breadcrumb className="min-w-0 flex-1">
        <BreadcrumbList className="flex-nowrap">
          {crumbs.map((c, i) => (
            <Fragment key={c.href}>
              {i > 0 && <BreadcrumbSeparator className="max-sm:hidden" />}
              <BreadcrumbItem className={cn("min-w-0", i < crumbs.length - 1 && "max-sm:hidden")}>
                {i === crumbs.length - 1 ? (
                  <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                ) : (
                  <Link href={c.href} className="truncate transition-colors hover:text-foreground">
                    {c.label}
                  </Link>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-8 items-center gap-2 rounded-lg border bg-muted/40 px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted sm:w-64"
        aria-label="Search (Ctrl+K)"
      >
        <Search className="size-4" aria-hidden />
        <span className="hidden flex-1 text-left sm:block">Search…</span>
        <span className="hidden items-center gap-0.5 sm:flex">
          <Kbd>Ctrl</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>
      <NotificationBell unread={unread} notifications={notifications} />
      <HelpMenu />
      <div className="hidden sm:block">
        <AccountMenu compact />
      </div>
    </header>
  );
}

function NotificationBell({ unread, notifications }: { unread: number; notifications: BellNotification[] }) {
  const router = useRouter();
  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" className="relative" aria-label={`Notifications, ${unread} unread`} />}
      >
        <Bell />
        {unread > 0 && (
          <span
            data-testid="unread-badge"
            className="absolute top-1 right-1 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-4 font-semibold text-white tabular"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2.5">
          <p className="text-sm font-semibold">Notifications</p>
          {unread > 0 && (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline"
              onClick={async () => {
                await markNotificationsReadAction({ ids: "all" });
                router.refresh();
              }}
            >
              Mark all as read
            </button>
          )}
        </div>
        <ul className="max-h-80 overflow-y-auto">
          {notifications.length === 0 && <li className="px-3 py-8 text-center text-sm text-muted-foreground">You&apos;re all caught up.</li>}
          {notifications.map((n) => (
            <li key={n.id}>
              <Link
                href={n.link ?? "/dashboard/notifications"}
                onClick={() => {
                  if (!n.readAt) void markNotificationsReadAction({ ids: [n.id] }).then(() => router.refresh());
                }}
                className="flex gap-2.5 border-b px-3 py-2.5 last:border-0 hover:bg-muted/50"
              >
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-primary")} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm", !n.readAt && "font-medium")}>{n.title}</span>
                  {n.body && <span className="block truncate text-xs text-muted-foreground">{n.body}</span>}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatRelative(n.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/dashboard/notifications" className="block border-t px-3 py-2 text-center text-sm font-medium text-primary hover:bg-muted/50">
          View all notifications
        </Link>
      </PopoverContent>
    </Popover>
  );
}

function HelpMenu() {
  return (
    <Popover>
      <PopoverTrigger render={<Button variant="ghost" size="icon" aria-label="Help" />}>
        <CircleHelp />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <p className="text-sm font-semibold">Help & shortcuts</p>
        <ul className="grid gap-2 text-sm">
          <li className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-muted-foreground">
              <Keyboard className="size-4" /> Search everything
            </span>
            <span className="flex gap-0.5">
              <Kbd>Ctrl</Kbd>
              <Kbd>K</Kbd>
            </span>
          </li>
          <li>
            <Link href="/#faq" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <BookOpen className="size-4" /> Product FAQ
            </Link>
          </li>
          <li>
            <Link href="/contact" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
              <LifeBuoy className="size-4" /> Contact support
            </Link>
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}
