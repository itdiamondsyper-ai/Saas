"use client";

import { usePathname } from "next/navigation";
import { useState } from "react";
import { Info } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { AppProvider, type AppContextValue } from "./app-context";
import { CommandMenu } from "./command-menu";
import { Sidebar } from "./sidebar";
import { Topbar, type BellNotification } from "./topbar";

export function AppFrame({
  value,
  unread,
  notifications,
  children,
}: {
  value: AppContextValue;
  unread: number;
  notifications: BellNotification[];
  children: React.ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();

  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  return (
    <AppProvider value={value}>
      <div className="flex min-h-screen">
        <a
          href="#main"
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
        >
          Skip to content
        </a>
        <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 border-r lg:block">
          <Sidebar unread={unread} />
        </aside>
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SheetDescription className="sr-only">Workspace navigation</SheetDescription>
            <Sidebar unread={unread} onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex min-w-0 flex-1 flex-col">
          {value.demoMode && (
            <div className="no-print flex items-center justify-center gap-2 border-b bg-primary/6 px-4 py-1.5 text-center text-xs text-muted-foreground">
              <Info className="size-3.5 shrink-0 text-primary" aria-hidden />
              Demo mode: data is stored locally on this server. Connect Supabase to go live.
            </div>
          )}
          <Topbar
            onOpenMenu={() => setMenuOpen(true)}
            onOpenSearch={() => setSearchOpen(true)}
            unread={unread}
            notifications={notifications}
          />
          <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            {children}
          </main>
        </div>
      </div>
      <CommandMenu open={searchOpen} onOpenChange={setSearchOpen} />
    </AppProvider>
  );
}
