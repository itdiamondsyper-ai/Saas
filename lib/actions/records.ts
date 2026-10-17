"use server";

import { z } from "zod";
import { runAction } from "@/lib/server/action";
import { createClient, deleteClient, setClientStatus, updateClient } from "@/lib/services/clients";
import {
  addExpense,
  createProject,
  deleteExpense,
  deleteProject,
  setProjectStatus,
  updateProject,
} from "@/lib/services/projects";
import {
  addComment,
  createTask,
  deleteComment,
  deleteTask,
  getTaskDetail,
  moveTask,
  setTaskStatus,
  updateTask,
} from "@/lib/services/tasks";
import {
  cancelInvoice,
  createInvoice,
  deleteDraftInvoice,
  duplicateInvoice,
  markInvoicePaid,
  markInvoiceSent,
  updateInvoice,
} from "@/lib/services/invoices";
import { deleteFile } from "@/lib/services/files";
import { uuid } from "@/lib/validation/common";
import {
  clientSchema,
  clientStatus,
  commentSchema,
  expenseSchema,
  invoiceSchema,
  moveTaskSchema,
  projectSchema,
  projectStatus,
  taskSchema,
  taskStatus,
} from "@/lib/validation/schemas";

const idOnly = z.object({ id: uuid });
const withId = <T extends z.ZodType>(schema: T) => z.object({ id: uuid, values: schema });

// --- Clients ----------------------------------------------------------------

export async function createClientAction(input: unknown) {
  return runAction(clientSchema, input, { permission: "records:write" }, async (ctx, data) => {
    const client = await createClient(ctx, data);
    return { id: client.id };
  });
}

export async function updateClientAction(input: unknown) {
  return runAction(withId(clientSchema), input, { permission: "records:write" }, async (ctx, { id, values }) => {
    await updateClient(ctx, id, values);
    return { id };
  });
}

export async function setClientStatusAction(input: unknown) {
  return runAction(z.object({ id: uuid, status: clientStatus }), input, { permission: "records:write" }, (ctx, d) =>
    setClientStatus(ctx, d.id, d.status),
  );
}

export async function deleteClientAction(input: unknown) {
  return runAction(idOnly, input, { permission: "records:delete" }, (ctx, d) => deleteClient(ctx, d.id));
}

// --- Projects ---------------------------------------------------------------

export async function createProjectAction(input: unknown) {
  return runAction(projectSchema, input, { permission: "records:write" }, async (ctx, data) => {
    const project = await createProject(ctx, data);
    return { id: project.id };
  });
}

export async function updateProjectAction(input: unknown) {
  return runAction(withId(projectSchema), input, { permission: "records:write" }, async (ctx, { id, values }) => {
    await updateProject(ctx, id, values);
    return { id };
  });
}

export async function setProjectStatusAction(input: unknown) {
  return runAction(z.object({ id: uuid, status: projectStatus }), input, { permission: "records:write" }, async (ctx, d) => {
    await setProjectStatus(ctx, d.id, d.status);
  });
}

export async function deleteProjectAction(input: unknown) {
  return runAction(idOnly, input, { permission: "records:delete" }, (ctx, d) => deleteProject(ctx, d.id));
}

export async function addExpenseAction(input: unknown) {
  return runAction(expenseSchema, input, { permission: "records:write" }, async (ctx, data) => {
    await addExpense(ctx, data);
  });
}

export async function deleteExpenseAction(input: unknown) {
  return runAction(idOnly, input, { permission: "records:delete" }, (ctx, d) => deleteExpense(ctx, d.id));
}

// --- Tasks ------------------------------------------------------------------

export async function createTaskAction(input: unknown) {
  return runAction(taskSchema, input, { permission: "records:write" }, async (ctx, data) => {
    const task = await createTask(ctx, data);
    return { id: task.id };
  });
}

export async function updateTaskAction(input: unknown) {
  return runAction(withId(taskSchema), input, { permission: "records:write" }, async (ctx, { id, values }) => {
    await updateTask(ctx, id, values);
    return { id };
  });
}

export async function moveTaskAction(input: unknown) {
  return runAction(moveTaskSchema, input, { permission: "records:write" }, async (ctx, d) => {
    await moveTask(ctx, d.id, d.status, d.beforeId);
  });
}

export async function setTaskStatusAction(input: unknown) {
  return runAction(z.object({ id: uuid, status: taskStatus }), input, { permission: "records:write" }, async (ctx, d) => {
    await setTaskStatus(ctx, d.id, d.status);
  });
}

export async function deleteTaskAction(input: unknown) {
  return runAction(idOnly, input, { permission: "tasks:delete" }, (ctx, d) => deleteTask(ctx, d.id));
}

export async function getTaskDetailAction(input: unknown) {
  return runAction(idOnly, input, { revalidate: false }, async (ctx, d) => getTaskDetail(ctx, d.id));
}

export async function addCommentAction(input: unknown) {
  return runAction(commentSchema, input, { permission: "records:write" }, async (ctx, d) => {
    await addComment(ctx, d.taskId, d.body);
  });
}

export async function deleteCommentAction(input: unknown) {
  return runAction(idOnly, input, { permission: "records:write" }, (ctx, d) => deleteComment(ctx, d.id));
}

// --- Invoices ---------------------------------------------------------------

export async function createInvoiceAction(input: unknown) {
  return runAction(invoiceSchema, input, { permission: "records:write" }, async (ctx, data) => {
    const invoice = await createInvoice(ctx, data);
    return { id: invoice.id };
  });
}

export async function updateInvoiceAction(input: unknown) {
  return runAction(withId(invoiceSchema), input, { permission: "records:write" }, async (ctx, { id, values }) => {
    await updateInvoice(ctx, id, values);
    return { id };
  });
}

export async function duplicateInvoiceAction(input: unknown) {
  return runAction(idOnly, input, { permission: "records:write" }, async (ctx, d) => {
    const copy = await duplicateInvoice(ctx, d.id);
    return { id: copy.id, number: copy.number };
  });
}

export async function markInvoiceSentAction(input: unknown) {
  return runAction(idOnly, input, { permission: "records:write" }, async (ctx, d) => {
    await markInvoiceSent(ctx, d.id);
  });
}

export async function markInvoicePaidAction(input: unknown) {
  return runAction(idOnly, input, { permission: "records:write" }, async (ctx, d) => {
    await markInvoicePaid(ctx, d.id);
  });
}

export async function cancelInvoiceAction(input: unknown) {
  return runAction(idOnly, input, { permission: "records:write" }, async (ctx, d) => {
    await cancelInvoice(ctx, d.id);
  });
}

export async function deleteInvoiceAction(input: unknown) {
  return runAction(idOnly, input, { permission: "invoices:delete_draft" }, (ctx, d) => deleteDraftInvoice(ctx, d.id));
}

// --- Files ------------------------------------------------------------------

export async function deleteFileAction(input: unknown) {
  return runAction(idOnly, input, { permission: "records:write" }, async (ctx, d) => {
    await deleteFile(ctx, d.id);
  });
}
