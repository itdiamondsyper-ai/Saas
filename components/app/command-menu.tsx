"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { CheckSquare, FileText, FolderKanban, Loader2, Plus, Search, Users } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/shared/kbd";
import { searchAction } from "@/lib/actions/account";
import type { SearchResult } from "@/lib/services/search";
import { NAV_ITEMS } from "./nav-items";

const ICONS = { client: Users, project: FolderKanban, task: CheckSquare, invoice: FileText };
const GROUP_LABELS = { client: "Clients", project: "Projects", task: "Tasks", invoice: "Invoices" };

const QUICK_ACTIONS = [
  { label: "New client", href: "/dashboard/clients?new=1" },
  { label: "New project", href: "/dashboard/projects?new=1" },
  { label: "New task", href: "/dashboard/tasks?new=1" },
  { label: "New invoice", href: "/dashboard/invoices/new" },
];

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => () => clearTimeout(timer.current), []);

  // Debounced search; stale responses are ignored via a request counter.
  const onQueryChange = (value: string) => {
    setQuery(value);
    clearTimeout(timer.current);
    const term = value.trim();
    const id = ++requestId.current;
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const result = await searchAction({ q: term }).catch(() => null);
      if (id !== requestId.current) return;
      setLoading(false);
      if (result?.ok) {
        setResults(result.data);
        setError(null);
      } else {
        setError(result?.error ?? "Search is unavailable right now.");
      }
    }, 180);
  };

  const grouped = useMemo(() => {
    const groups = new Map<SearchResult["type"], SearchResult[]>();
    for (const r of results) groups.set(r.type, [...(groups.get(r.type) ?? []), r]);
    return [...groups.entries()];
  }, [results]);

  const go = (href: string) => {
    onOpenChange(false);
    onQueryChange("");
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[15%] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search FlowPilot</DialogTitle>
        <DialogDescription className="sr-only">Search clients, projects, tasks and invoices, or jump to a page.</DialogDescription>
        <Command shouldFilter={false} className="rounded-none!" label="Global search">
          <div className="flex items-center gap-2 border-b px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <CommandPrimitiveInput value={query} onValueChange={onQueryChange} />
            {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Searching" />}
          </div>
          <CommandList className="max-h-[min(420px,60vh)] p-1">
            {query.trim() ? (
              <>
                {!loading && !error && <CommandEmpty>No results for “{query.trim()}”.</CommandEmpty>}
                {error && <p className="px-3 py-6 text-center text-sm text-destructive">{error}</p>}
                {grouped.map(([type, items]) => {
                  const Icon = ICONS[type];
                  return (
                    <CommandGroup key={type} heading={GROUP_LABELS[type]}>
                      {items.map((item) => (
                        <CommandItem key={item.id} value={`${type}-${item.id}`} onSelect={() => go(item.href)}>
                          <Icon className="text-muted-foreground" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate">{item.title}</span>
                            <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  );
                })}
              </>
            ) : (
              <>
                <CommandGroup heading="Quick actions">
                  {QUICK_ACTIONS.map((a) => (
                    <CommandItem key={a.href} value={a.label} onSelect={() => go(a.href)}>
                      <Plus className="text-muted-foreground" /> {a.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup heading="Go to">
                  {NAV_ITEMS.map((item) => (
                    <CommandItem key={item.href} value={item.label} onSelect={() => go(item.href)}>
                      <item.icon className="text-muted-foreground" /> {item.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>Search clients, projects, tasks and invoices</span>
            <span className="hidden items-center gap-1 sm:flex">
              <Kbd>↵</Kbd> to open <Kbd>Esc</Kbd> to close
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}


function CommandPrimitiveInput(props: { value: string; onValueChange: (v: string) => void }) {
  return (
    <CommandPrimitive.Input
      autoFocus
      placeholder="Search or jump to…"
      aria-label="Search"
      className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
      {...props}
    />
  );
}
