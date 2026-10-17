import { z } from "zod";
import {
  dateString,
  email,
  money,
  optionalDate,
  optionalEmail,
  optionalText,
  optionalUrl,
  optionalUuid,
  requiredText,
  tagList,
  uuid,
} from "./common";

// --- Auth -------------------------------------------------------------------
export const password = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(72, "Use 72 characters or fewer");

export const signUpSchema = z.object({
  fullName: requiredText("Full name", 80),
  email,
  password,
  workspaceName: requiredText("Company or workspace name", 80),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirmPassword: z.string(), token: z.string().max(200).optional() })
  .refine((d) => d.password === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

export const changePasswordSchema = z
  .object({ currentPassword: z.string().min(1, "Enter your current password"), newPassword: password, confirmPassword: z.string() })
  .refine((d) => d.newPassword === d.confirmPassword, { message: "Passwords don't match", path: ["confirmPassword"] });

// --- Onboarding & workspace -------------------------------------------------
export const businessInfoSchema = z.object({
  name: requiredText("Company name", 80),
  industry: requiredText("Industry", 80),
  teamSize: requiredText("Team size", 20),
});

export const goalSchema = z.object({ goal: requiredText("Goal", 60) });

export const workspaceSettingsSchema = z.object({
  name: requiredText("Workspace name", 80),
  industry: optionalText(80),
  teamSize: optionalText(20),
});

export const createWorkspaceSchema = z.object({ name: requiredText("Workspace name", 80) });

// --- Profile ----------------------------------------------------------------
export const profileSchema = z.object({
  fullName: requiredText("Full name", 80),
  jobTitle: optionalText(80),
});

export const emailChangeSchema = z.object({ email });

export const notificationPrefsSchema = z.object({
  email: z.boolean(),
  invoices: z.boolean(),
  tasks: z.boolean(),
  weekly_report: z.boolean(),
});

// --- Clients ----------------------------------------------------------------
export const clientStatus = z.enum(["lead", "active", "inactive", "archived"]);

export const clientSchema = z.object({
  company: requiredText("Company", 120),
  contactName: requiredText("Contact name", 80),
  email: optionalEmail,
  phone: optionalText(40),
  website: optionalUrl,
  industry: optionalText(80),
  address: optionalText(240),
  status: clientStatus,
  tags: tagList,
  notes: optionalText(5000),
});

// --- Projects ---------------------------------------------------------------
export const projectStatus = z.enum(["planning", "active", "in_review", "completed", "on_hold"]);
export const priority = z.enum(["low", "medium", "high", "urgent"]);

export const projectSchema = z
  .object({
    name: requiredText("Project name", 120),
    clientId: optionalUuid,
    ownerId: optionalUuid,
    status: projectStatus,
    priority,
    startDate: optionalDate,
    dueDate: optionalDate,
    budget: money("Budget"),
    progress: z.coerce.number().int().min(0).max(100),
    description: optionalText(5000),
    memberIds: z.array(uuid).max(50).default([]),
  })
  .refine((d) => !d.startDate || !d.dueDate || d.dueDate >= d.startDate, {
    message: "Due date must be on or after the start date",
    path: ["dueDate"],
  });

export const expenseSchema = z.object({
  projectId: optionalUuid,
  description: requiredText("Description", 200),
  category: requiredText("Category", 40),
  amount: money("Amount").refine((v) => v > 0, "Amount must be greater than zero"),
  incurredOn: dateString,
});

// --- Tasks ------------------------------------------------------------------
export const taskStatus = z.enum(["backlog", "todo", "in_progress", "review", "done"]);

export const taskSchema = z.object({
  title: requiredText("Title", 200),
  description: optionalText(5000),
  projectId: optionalUuid,
  assigneeId: optionalUuid,
  status: taskStatus,
  priority,
  dueDate: optionalDate,
  labels: tagList,
});

export const moveTaskSchema = z.object({
  id: uuid,
  status: taskStatus,
  /** Id of the task that should come right after the moved task, or null for the end. */
  beforeId: uuid.nullable(),
});

export const commentSchema = z.object({ taskId: uuid, body: requiredText("Comment", 4000) });

// --- Invoices ---------------------------------------------------------------
export const invoiceItemSchema = z.object({
  description: requiredText("Description", 300),
  quantity: z.coerce.number({ error: "Quantity must be a number" }).positive("Quantity must be greater than zero").max(100000),
  unitPrice: money("Rate"),
});

export const invoiceSchema = z
  .object({
    clientId: uuid,
    projectId: optionalUuid,
    issueDate: dateString,
    dueDate: dateString,
    taxRate: z.coerce.number({ error: "Tax rate must be a number" }).min(0, "Tax rate can't be negative").max(100, "Tax rate can't exceed 100%"),
    notes: optionalText(2000),
    items: z.array(invoiceItemSchema).min(1, "Add at least one line item").max(100),
  })
  .refine((d) => d.dueDate >= d.issueDate, { message: "Due date must be on or after the issue date", path: ["dueDate"] });

// --- Team -------------------------------------------------------------------
export const inviteRole = z.enum(["admin", "member", "viewer"]);
export const memberRole = z.enum(["owner", "admin", "member", "viewer"]);

export const inviteSchema = z.object({ email, role: inviteRole });

export const changeRoleSchema = z.object({ userId: uuid, role: memberRole });

// --- Billing ----------------------------------------------------------------
export const planSchema = z.object({ plan: z.enum(["starter", "pro", "business"]) });

export type ClientInput = z.input<typeof clientSchema>;
export type ProjectInput = z.input<typeof projectSchema>;
export type TaskInput = z.input<typeof taskSchema>;
export type InvoiceInput = z.input<typeof invoiceSchema>;
