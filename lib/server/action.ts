import "server-only";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserFacingError } from "@/lib/backend/types";
import { DbError } from "@/lib/db/types";
import type { Permission } from "@/lib/permissions";
import { assertCan, getWorkspaceContext, type WorkspaceContext } from "./context";

export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    result[key] ??= issue.message;
  }
  return result;
}

/** Converts any thrown error into a response that is safe to send to the browser. */
export function toActionError(error: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (error instanceof z.ZodError) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(error) };
  }
  if (error instanceof UserFacingError) return { ok: false, error: error.message };
  if (error instanceof DbError) {
    if (error.code === "unique_violation") return { ok: false, error: "A record with these details already exists." };
    if (error.code === "foreign_key_violation") {
      return { ok: false, error: "This record is linked to other records and can't be changed that way." };
    }
    if (error.code === "not_allowed") return { ok: false, error: "You don't have permission to do that." };
  }
  console.error("[action] unexpected error", error);
  return { ok: false, error: "Something went wrong on our side. Please try again." };
}

interface RunOptions {
  permission?: Permission;
  /** Paths to revalidate after a successful mutation. Defaults to the whole dashboard. */
  revalidate?: string[] | false;
}

/**
 * Runs a workspace-scoped mutation: resolves the session and active workspace on the
 * server, checks permissions, validates input with Zod and maps errors to safe messages.
 */
export async function runAction<S extends z.ZodType, T>(
  schema: S,
  input: unknown,
  options: RunOptions,
  handler: (ctx: WorkspaceContext, data: z.output<S>) => Promise<T>,
): Promise<ActionResult<T>> {
  try {
    const ctx = await getWorkspaceContext();
    if (!ctx) return { ok: false, error: "Your session has expired. Please log in again." };
    if (options.permission) assertCan(ctx, options.permission);
    const data = schema.parse(input);
    const result = await handler(ctx, data);
    if (options.revalidate !== false) {
      for (const path of options.revalidate ?? ["/dashboard"]) revalidatePath(path, "layout");
    }
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}
