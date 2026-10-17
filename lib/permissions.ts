import type { WorkspaceRole } from "@/types/database";

// Authorization matrix shared by server actions and UI. The UI uses it only to
// hide controls; every server action calls `assertCan` before touching data,
// and Postgres RLS enforces the same rules again in Supabase mode.

export type Permission =
  | "records:write" // create and edit clients, projects, tasks, invoices
  | "records:delete" // delete clients, projects, expenses
  | "tasks:delete"
  | "invoices:delete_draft"
  | "team:manage" // invite, remove, change roles
  | "workspace:update"
  | "billing:manage"
  | "workspace:delete";

const RANK: Record<WorkspaceRole, number> = { viewer: 1, member: 2, admin: 3, owner: 4 };

const MIN_ROLE: Record<Permission, WorkspaceRole> = {
  "records:write": "member",
  "records:delete": "admin",
  "tasks:delete": "member",
  "invoices:delete_draft": "member",
  "team:manage": "admin",
  "workspace:update": "admin",
  "billing:manage": "owner",
  "workspace:delete": "owner",
};

export function can(role: WorkspaceRole, permission: Permission): boolean {
  return RANK[role] >= RANK[MIN_ROLE[permission]];
}

export function roleRank(role: WorkspaceRole): number {
  return RANK[role];
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<WorkspaceRole, string> = {
  owner: "Full access, including billing and deleting the workspace.",
  admin: "Manage team members, settings and all records.",
  member: "Create and edit clients, projects, tasks and invoices.",
  viewer: "Read-only access to the workspace.",
};
