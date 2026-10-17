"use client";

import { CalendarDays, MessageSquare } from "lucide-react";
import { PriorityLabel } from "@/components/shared/badges";
import { UserAvatar } from "@/components/shared/user-avatar";
import { daysBetween, todayString } from "@/lib/dates";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Priority, TaskStatus } from "@/types/database";

export interface BoardTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  labels: string[];
  position: number;
  project: { id: string; name: string } | null;
  assignee: { id: string; name: string; avatarUrl: string | null } | null;
  commentCount: number;
}

export function DueDate({ date, done }: { date: string | null; done: boolean }) {
  if (!date) return null;
  const days = daysBetween(todayString(), date);
  const tone = done ? "text-muted-foreground" : days < 0 ? "text-destructive" : days <= 2 ? "text-warning" : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs", tone)}>
      <CalendarDays className="size-3" aria-hidden />
      {formatDate(date)}
      {!done && days < 0 && <span className="sr-only">(overdue)</span>}
    </span>
  );
}

export function TaskCardBody({ task, className }: { task: BoardTask; className?: string }) {
  return (
    <div className={cn("space-y-2.5 rounded-lg border bg-card p-3 text-left shadow-xs", className)}>
      <div className="space-y-1">
        <p className={cn("text-sm leading-snug font-medium", task.status === "done" && "text-muted-foreground line-through decoration-muted-foreground/40")}>
          {task.title}
        </p>
        {task.project && <p className="truncate text-xs text-muted-foreground">{task.project.name}</p>}
      </div>
      {task.labels.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.labels.slice(0, 3).map((l) => (
            <span key={l} className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {l}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        <PriorityLabel priority={task.priority} iconOnly />
        <DueDate date={task.due_date} done={task.status === "done"} />
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
            <MessageSquare className="size-3" aria-hidden />
            {task.commentCount}
            <span className="sr-only"> comments</span>
          </span>
        )}
        <span className="ml-auto">
          {task.assignee ? (
            <UserAvatar name={task.assignee.name} src={task.assignee.avatarUrl} size="sm" />
          ) : (
            <span className="text-[10px] text-muted-foreground">Unassigned</span>
          )}
        </span>
      </div>
    </div>
  );
}
