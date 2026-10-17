import type { ClientStatus, InvoiceStatus, Priority, ProjectStatus, TaskStatus } from "@/types/database";

export type Tone = "neutral" | "info" | "success" | "warning" | "danger" | "brand";

export const CLIENT_STATUSES: { value: ClientStatus; label: string; tone: Tone }[] = [
  { value: "lead", label: "Lead", tone: "info" },
  { value: "active", label: "Active", tone: "success" },
  { value: "inactive", label: "Inactive", tone: "warning" },
  { value: "archived", label: "Archived", tone: "neutral" },
];

export const PROJECT_STATUSES: { value: ProjectStatus; label: string; tone: Tone }[] = [
  { value: "planning", label: "Planning", tone: "info" },
  { value: "active", label: "Active", tone: "brand" },
  { value: "in_review", label: "In Review", tone: "warning" },
  { value: "completed", label: "Completed", tone: "success" },
  { value: "on_hold", label: "On Hold", tone: "neutral" },
];

export const PRIORITIES: { value: Priority; label: string; tone: Tone }[] = [
  { value: "low", label: "Low", tone: "neutral" },
  { value: "medium", label: "Medium", tone: "info" },
  { value: "high", label: "High", tone: "warning" },
  { value: "urgent", label: "Urgent", tone: "danger" },
];

export const TASK_STATUSES: { value: TaskStatus; label: string; tone: Tone }[] = [
  { value: "backlog", label: "Backlog", tone: "neutral" },
  { value: "todo", label: "To Do", tone: "info" },
  { value: "in_progress", label: "In Progress", tone: "brand" },
  { value: "review", label: "Review", tone: "warning" },
  { value: "done", label: "Done", tone: "success" },
];

export const INVOICE_STATUSES: { value: InvoiceStatus; label: string; tone: Tone }[] = [
  { value: "draft", label: "Draft", tone: "neutral" },
  { value: "sent", label: "Sent", tone: "info" },
  { value: "paid", label: "Paid", tone: "success" },
  { value: "overdue", label: "Overdue", tone: "danger" },
  { value: "cancelled", label: "Cancelled", tone: "neutral" },
];

export function lookup<T extends string>(list: { value: T; label: string; tone: Tone }[], value: T) {
  return list.find((item) => item.value === value) ?? { value, label: value, tone: "neutral" as Tone };
}

export const INDUSTRIES = [
  "Design & creative agency",
  "Software & SaaS",
  "Consulting",
  "Marketing & advertising",
  "Architecture & engineering",
  "Media & publishing",
  "Retail & e-commerce",
  "Health & wellness",
  "Professional services",
  "Other",
];

export const TEAM_SIZES = ["Just me", "2-10", "11-25", "26-50", "51+"];

export const PRIMARY_GOALS = [
  { value: "Manage clients", description: "Keep contacts, notes and deals in one CRM." },
  { value: "Manage projects", description: "Plan work, track progress and hit deadlines." },
  { value: "Invoice clients", description: "Send professional invoices and get paid faster." },
  { value: "Track business performance", description: "See revenue, profit and trends at a glance." },
  { value: "Manage team", description: "Assign work and keep everyone in sync." },
];
