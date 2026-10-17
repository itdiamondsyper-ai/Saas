"use client";

import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { useQueryState } from "@/hooks/use-query-state";

const TYPES = [
  { value: "client", label: "Clients" },
  { value: "project", label: "Projects" },
  { value: "task", label: "Tasks" },
  { value: "invoice", label: "Invoices" },
  { value: "member", label: "Team" },
  { value: "workspace", label: "Settings" },
  { value: "file", label: "Files" },
];

export function ActivityFilters({ members, total, page, pageSize }: { members: { id: string; label: string }[]; total: number; page: number; pageSize: number }) {
  const { params, set, pending } = useQueryState();
  const filtered = ["q", "type", "user"].some((k) => params.get(k));
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className={`space-y-3 ${pending ? "opacity-70" : ""}`}>
      <div className="flex flex-col gap-2 md:flex-row md:items-center">
        <SearchInput value={params.get("q") ?? ""} onChange={(v) => set({ q: v })} placeholder="Search activity…" label="Search activity" />
        <div className="grid grid-cols-2 gap-2 md:flex">
          <NativeSelect aria-label="Filter by type" value={params.get("type") ?? ""} onChange={(e) => set({ type: e.target.value })} className="md:w-40">
            <option value="">All events</option>
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect aria-label="Filter by user" value={params.get("user") ?? ""} onChange={(e) => set({ user: e.target.value })} className="md:w-44">
            <option value="">Everyone</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </NativeSelect>
        </div>
        {filtered && (
          <Button variant="ghost" size="sm" onClick={() => set({ q: null, type: null, user: null })}>
            Clear filters
          </Button>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => set({ page: String(page - 1) }, { resetPage: false })}>
            Newer
          </Button>
          <span className="text-xs text-muted-foreground tabular">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => set({ page: String(page + 1) }, { resetPage: false })}>
            Older
          </Button>
        </div>
      )}
    </div>
  );
}
