"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getBackend, UserFacingError } from "@/lib/backend";
import { runAction, toActionError, type ActionResult } from "@/lib/server/action";
import { getSessionUser, getWorkspaceContext, WORKSPACE_COOKIE } from "@/lib/server/context";
import { createClient } from "@/lib/services/clients";
import { createProject } from "@/lib/services/projects";
import { inviteMember } from "@/lib/services/team";
import { updateWorkspace } from "@/lib/services/workspace";
import { uuid } from "@/lib/validation/common";
import {
  businessInfoSchema,
  clientSchema,
  createWorkspaceSchema,
  goalSchema,
  inviteRole,
  projectSchema,
} from "@/lib/validation/schemas";
import { email } from "@/lib/validation/common";

const cookieOptions = { path: "/", sameSite: "lax" as const, httpOnly: true, maxAge: 31_536_000 };

export async function switchWorkspaceAction(workspaceId: string): Promise<ActionResult> {
  try {
    const id = uuid.parse(workspaceId);
    const ctx = await getWorkspaceContext();
    if (!ctx) throw new UserFacingError("Your session has expired. Please log in again.");
    // Never trust the client-supplied id: it must be one of the user's memberships.
    if (!ctx.memberships.some((m) => m.workspace.id === id)) {
      throw new UserFacingError("You don't have access to that workspace.");
    }
    (await cookies()).set(WORKSPACE_COOKIE, id, cookieOptions);
    revalidatePath("/dashboard", "layout");
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function createWorkspaceAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const user = await getSessionUser();
    if (!user) throw new UserFacingError("Your session has expired. Please log in again.");
    const data = createWorkspaceSchema.parse(input);
    const id = await getBackend().createWorkspace(user.id, data.name, null);
    (await cookies()).set(WORKSPACE_COOKIE, id, cookieOptions);
    revalidatePath("/", "layout");
    return { ok: true, data: { redirectTo: "/onboarding" } };
  } catch (error) {
    return toActionError(error);
  }
}

// --- Onboarding -------------------------------------------------------------

export async function saveBusinessInfoAction(input: unknown) {
  return runAction(businessInfoSchema, input, { permission: "workspace:update", revalidate: ["/onboarding"] }, (ctx, data) =>
    updateWorkspace(ctx, { name: data.name, industry: data.industry, teamSize: data.teamSize }).then(() => undefined),
  );
}

export async function saveGoalAction(input: unknown) {
  return runAction(goalSchema, input, { permission: "workspace:update", revalidate: ["/onboarding"] }, (ctx, data) =>
    updateWorkspace(ctx, { primaryGoal: data.goal }).then(() => undefined),
  );
}

const invitesSchema = z.object({
  invites: z.array(z.object({ email, role: inviteRole })).max(10),
});

export async function sendOnboardingInvitesAction(input: unknown) {
  return runAction(invitesSchema, input, { permission: "team:manage", revalidate: ["/onboarding"] }, async (ctx, data) => {
    const links: { email: string; link: string }[] = [];
    for (const invite of data.invites) {
      const { link } = await inviteMember(ctx, invite.email, invite.role);
      links.push({ email: invite.email, link });
    }
    return links;
  });
}

const finishSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("client"), client: clientSchema }),
  z.object({ kind: z.literal("project"), project: projectSchema }),
  z.object({ kind: z.literal("skip") }),
]);

export async function finishOnboardingAction(input: unknown) {
  return runAction(finishSchema, input, { permission: "workspace:update", revalidate: ["/dashboard", "/onboarding"] }, async (ctx, data) => {
    let href = "/dashboard";
    if (data.kind === "client") href = `/dashboard/clients/${(await createClient(ctx, data.client)).id}`;
    if (data.kind === "project") href = `/dashboard/projects/${(await createProject(ctx, data.project)).id}`;
    await updateWorkspace(ctx, { onboardingCompleted: true });
    return { redirectTo: href };
  });
}
