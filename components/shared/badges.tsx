import { ArrowDown, ArrowUp, ChevronsUp, Minus } from "lucide-react";
import {
  CLIENT_STATUSES,
  INVOICE_STATUSES,
  PRIORITIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
  lookup,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ClientStatus, InvoiceStatus, Priority, ProjectStatus, TaskStatus } from "@/types/database";
import { StatusBadge } from "./status-badge";

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const s = lookup(CLIENT_STATUSES, status);
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const s = lookup(PROJECT_STATUSES, status);
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  const s = lookup(TASK_STATUSES, status);
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const s = lookup(INVOICE_STATUSES, status);
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

const PRIORITY_ICON = { low: ArrowDown, medium: Minus, high: ArrowUp, urgent: ChevronsUp };
const PRIORITY_COLOR = {
  low: "text-muted-foreground",
  medium: "text-info",
  high: "text-warning",
  urgent: "text-destructive",
};

export function PriorityLabel({ priority, className, iconOnly = false }: { priority: Priority; className?: string; iconOnly?: boolean }) {
  const Icon = PRIORITY_ICON[priority];
  const label = lookup(PRIORITIES, priority).label;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium", className)} title={`${label} priority`}>
      <Icon aria-hidden className={cn("size-3.5", PRIORITY_COLOR[priority])} />
      {iconOnly ? <span className="sr-only">{label} priority</span> : label}
    </span>
  );
}

export function AtRiskBadge() {
  return <StatusBadge tone="danger">At risk</StatusBadge>;
}
