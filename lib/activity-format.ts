import { PROJECT_STATUSES, TASK_STATUSES, lookup } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/permissions";
import type { ProjectStatus, TaskStatus, WorkspaceRole } from "@/types/database";

export interface ActivityDescription {
  /** Whether the sentence starts with the actor's name. */
  withActor: boolean;
  text: string;
}

/** Human-readable sentence for an activity log entry, e.g. "completed Design Homepage". */
export function describeActivity(action: string, entityName: string | null, metadata: Record<string, unknown> = {}): ActivityDescription {
  const name = entityName ?? "an item";
  const to = typeof metadata.to === "string" ? metadata.to : "";
  switch (action) {
    case "client.created":
      return { withActor: true, text: `added ${name} as a client` };
    case "client.updated":
      return { withActor: true, text: `updated client ${name}` };
    case "client.archived":
      return { withActor: true, text: `archived client ${name}` };
    case "client.deleted":
      return { withActor: true, text: `deleted client ${name}` };
    case "project.created":
      return { withActor: true, text: `created project ${name}` };
    case "project.updated":
      return { withActor: true, text: `updated project ${name}` };
    case "project.status_changed":
      return { withActor: false, text: `Project ${name} moved to ${lookup(PROJECT_STATUSES, to as ProjectStatus).label}` };
    case "project.deleted":
      return { withActor: true, text: `deleted project ${name}` };
    case "task.created":
      return { withActor: true, text: `created task ${name}` };
    case "task.completed":
      return { withActor: true, text: `completed ${name}` };
    case "task.status_changed":
      return { withActor: true, text: `moved ${name} to ${lookup(TASK_STATUSES, to as TaskStatus).label}` };
    case "task.assigned":
      return { withActor: true, text: `assigned ${name} to ${String(metadata.assignee ?? "a teammate")}` };
    case "task.updated":
      return { withActor: true, text: `updated task ${name}` };
    case "task.deleted":
      return { withActor: true, text: `deleted task ${name}` };
    case "comment.added":
      return { withActor: true, text: `commented on ${name}` };
    case "invoice.created":
      return { withActor: true, text: `created invoice #${name}` };
    case "invoice.updated":
      return { withActor: true, text: `updated invoice #${name}` };
    case "invoice.sent":
      return { withActor: true, text: `sent invoice #${name}` };
    case "invoice.paid":
      return { withActor: false, text: `Invoice #${name} was paid` };
    case "invoice.cancelled":
      return { withActor: true, text: `cancelled invoice #${name}` };
    case "invoice.deleted":
      return { withActor: true, text: `deleted draft invoice #${name}` };
    case "invoice.duplicated":
      return { withActor: true, text: `duplicated an invoice as #${name}` };
    case "member.invited":
      return { withActor: true, text: `invited ${name} to the workspace` };
    case "member.joined":
      return { withActor: true, text: `joined the workspace` };
    case "member.removed":
      return { withActor: true, text: `removed ${name} from the workspace` };
    case "member.role_changed":
      return { withActor: true, text: `changed ${name}'s role to ${ROLE_LABELS[to as WorkspaceRole] ?? to}` };
    case "settings.updated":
      return { withActor: true, text: `updated workspace settings` };
    case "billing.plan_changed":
      return { withActor: true, text: `changed the plan to ${String(metadata.plan ?? "a new plan")}` };
    case "file.uploaded":
      return { withActor: true, text: `uploaded ${name}` };
    case "file.deleted":
      return { withActor: true, text: `deleted file ${name}` };
    case "expense.created":
      return { withActor: true, text: `logged an expense: ${name}` };
    default:
      return { withActor: true, text: `${action.replace(/[._]/g, " ")} ${name}` };
  }
}

export const ACTIVITY_ENTITY_TYPES = ["client", "project", "task", "invoice", "member", "workspace", "file"] as const;

export function entityHref(entityType: string, entityId: string | null): string | null {
  if (!entityId) return null;
  switch (entityType) {
    case "client":
      return `/dashboard/clients/${entityId}`;
    case "project":
      return `/dashboard/projects/${entityId}`;
    case "invoice":
      return `/dashboard/invoices/${entityId}`;
    case "task":
      return `/dashboard/tasks?task=${entityId}`;
    default:
      return null;
  }
}
