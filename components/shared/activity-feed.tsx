import Link from "next/link";
import { Activity } from "lucide-react";
import { formatRelative } from "@/lib/format";
import type { ActivityItem } from "@/lib/services/activity";
import { EmptyState } from "./empty-state";
import { UserAvatar } from "./user-avatar";

export function ActivityFeed({ items, emptyText = "No activity yet." }: { items: ActivityItem[]; emptyText?: string }) {
  if (!items.length) return <EmptyState icon={Activity} title={emptyText} compact />;
  return (
    <ol className="space-y-4">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3">
          <UserAvatar name={item.actor?.name ?? "System"} src={item.actor?.avatarUrl} size="sm" className="mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm leading-snug">
              {item.href ? (
                <Link href={item.href} className="hover:underline">
                  {item.sentence}
                </Link>
              ) : (
                item.sentence
              )}
            </p>
            <time dateTime={item.createdAt} className="text-xs text-muted-foreground">
              {formatRelative(item.createdAt)}
            </time>
          </div>
        </li>
      ))}
    </ol>
  );
}
