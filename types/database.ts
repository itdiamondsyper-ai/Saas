// Row types mirroring supabase/migrations. Keep these in sync with the SQL schema.

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";
export type ClientStatus = "lead" | "active" | "inactive" | "archived";
export type ProjectStatus = "planning" | "active" | "in_review" | "completed" | "on_hold";
export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";
export type PlanTier = "starter" | "pro" | "business";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled" | "incomplete";

export interface NotificationPrefs {
  email: boolean;
  invoices: boolean;
  tasks: boolean;
  weekly_report: boolean;
}

interface Timestamps {
  created_at: string;
  updated_at: string;
}

export interface ProfileRow extends Timestamps {
  id: string;
  email: string;
  full_name: string;
  avatar_url: string | null;
  job_title: string | null;
  notification_prefs: NotificationPrefs;
  last_active_at: string | null;
}

export interface WorkspaceRow extends Timestamps {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  industry: string | null;
  team_size: string | null;
  primary_goal: string | null;
  onboarding_completed: boolean;
  created_by: string | null;
}

export interface WorkspaceMemberRow extends Timestamps {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
}

export interface WorkspaceInvitationRow extends Timestamps {
  id: string;
  workspace_id: string;
  email: string;
  role: WorkspaceRole;
  token: string;
  invited_by: string | null;
  accepted_at: string | null;
  expires_at: string;
}

export interface ClientRow extends Timestamps {
  id: string;
  workspace_id: string;
  company: string;
  contact_name: string;
  email: string | null;
  phone: string | null;
  website: string | null;
  industry: string | null;
  address: string | null;
  status: ClientStatus;
  tags: string[];
  notes: string | null;
  owner_id: string | null;
  last_activity_at: string;
}

export interface ProjectRow extends Timestamps {
  id: string;
  workspace_id: string;
  client_id: string | null;
  owner_id: string | null;
  name: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  start_date: string | null;
  due_date: string | null;
  progress: number;
  budget: number;
}

export interface ProjectMemberRow extends Timestamps {
  project_id: string;
  user_id: string;
  workspace_id: string;
}

export interface TaskRow extends Timestamps {
  id: string;
  workspace_id: string;
  project_id: string | null;
  assignee_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  due_date: string | null;
  labels: string[];
  position: number;
  completed_at: string | null;
}

export interface TaskCommentRow extends Timestamps {
  id: string;
  workspace_id: string;
  task_id: string;
  author_id: string | null;
  body: string;
}

export interface InvoiceRow extends Timestamps {
  id: string;
  workspace_id: string;
  client_id: string;
  project_id: string | null;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  currency: string;
  notes: string | null;
  sent_at: string | null;
  paid_at: string | null;
  created_by: string | null;
}

export interface InvoiceItemRow extends Timestamps {
  id: string;
  workspace_id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  position: number;
}

export interface ExpenseRow extends Timestamps {
  id: string;
  workspace_id: string;
  project_id: string | null;
  description: string;
  category: string;
  amount: number;
  incurred_on: string;
  created_by: string | null;
}

export interface FileRow extends Timestamps {
  id: string;
  workspace_id: string;
  client_id: string | null;
  project_id: string | null;
  name: string;
  size_bytes: number;
  mime_type: string;
  storage_path: string;
  uploaded_by: string | null;
}

export interface NotificationRow extends Timestamps {
  id: string;
  workspace_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
}

export interface ActivityLogRow extends Timestamps {
  id: string;
  workspace_id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  metadata: Record<string, unknown>;
}

export interface SubscriptionRow extends Timestamps {
  id: string;
  workspace_id: string;
  plan: PlanTier;
  status: SubscriptionStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  current_period_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  payment_method_brand: string | null;
  payment_method_last4: string | null;
}

export interface BillingHistoryRow extends Timestamps {
  id: string;
  workspace_id: string;
  stripe_invoice_id: string | null;
  description: string;
  amount: number;
  currency: string;
  status: string;
  invoice_url: string | null;
}

export interface Tables {
  profiles: ProfileRow;
  workspaces: WorkspaceRow;
  workspace_members: WorkspaceMemberRow;
  workspace_invitations: WorkspaceInvitationRow;
  clients: ClientRow;
  projects: ProjectRow;
  project_members: ProjectMemberRow;
  tasks: TaskRow;
  task_comments: TaskCommentRow;
  invoices: InvoiceRow;
  invoice_items: InvoiceItemRow;
  expenses: ExpenseRow;
  files: FileRow;
  notifications: NotificationRow;
  activity_logs: ActivityLogRow;
  subscriptions: SubscriptionRow;
  billing_history: BillingHistoryRow;
}

export type TableName = keyof Tables;

/** Columns the database fills in when omitted. */
type Generated = "id" | "created_at" | "updated_at";

export type InsertRow<K extends TableName> = Omit<Tables[K], Generated> &
  Partial<Pick<Tables[K], Extract<keyof Tables[K], Generated>>>;

export type UpdateRow<K extends TableName> = Partial<Omit<Tables[K], "id" | "created_at">>;
