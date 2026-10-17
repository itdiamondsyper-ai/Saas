import { Skeleton } from "@/components/ui/skeleton";
import { PageSkeleton } from "@/components/shared/page-skeleton";

export function AppShellSkeleton() {
  return (
    <div className="flex min-h-screen" aria-busy="true" aria-label="Loading workspace">
      <aside className="hidden w-60 shrink-0 space-y-4 border-r bg-sidebar p-3 lg:block">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-1.5">
          {Array.from({ length: 10 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-full" />
          ))}
        </div>
      </aside>
      <div className="flex-1">
        <div className="flex h-14 items-center gap-3 border-b px-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="ml-auto h-8 w-64 max-sm:w-8" />
          <Skeleton className="size-8 rounded-full" />
        </div>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}
