"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getBackend, UserFacingError } from "@/lib/backend";
import { toActionError, type ActionResult } from "@/lib/server/action";
import { getSessionUser, WORKSPACE_COOKIE } from "@/lib/server/context";
import { email } from "@/lib/validation/common";
import { forgotPasswordSchema, loginSchema, password, resetPasswordSchema, signUpSchema } from "@/lib/validation/schemas";

/** Only allow same-site relative redirects after login. */
function safeNext(next: unknown, fallback = "/dashboard"): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

const inviteSignUpSchema = z.object({
  fullName: signUpSchema.shape.fullName,
  email,
  password,
  inviteToken: z.string().min(10).max(200),
});

export async function signUpAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const raw = (input ?? {}) as { inviteToken?: string };
    const backend = getBackend();
    if (raw.inviteToken) {
      const data = inviteSignUpSchema.parse(input);
      const result = await backend.auth.signUp({ ...data, workspaceName: "" });
      if (result.status === "verify_email") {
        return { ok: true, data: { redirectTo: `/verify-email?email=${encodeURIComponent(data.email)}` } };
      }
      return { ok: true, data: { redirectTo: `/invite/${encodeURIComponent(data.inviteToken)}` } };
    }
    const data = signUpSchema.parse(input);
    const result = await backend.auth.signUp(data);
    if (result.status === "verify_email") {
      return { ok: true, data: { redirectTo: `/verify-email?email=${encodeURIComponent(data.email)}` } };
    }
    (await cookies()).delete(WORKSPACE_COOKIE);
    return { ok: true, data: { redirectTo: "/onboarding" } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function loginAction(input: unknown): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const data = loginSchema.parse(input);
    await getBackend().auth.signIn(data.email, data.password);
    (await cookies()).delete(WORKSPACE_COOKIE);
    return { ok: true, data: { redirectTo: safeNext((input as { next?: unknown })?.next) } };
  } catch (error) {
    return toActionError(error);
  }
}

export async function logoutAction() {
  await getBackend().auth.signOut();
  (await cookies()).delete(WORKSPACE_COOKIE);
  redirect("/login?signedOut=1");
}

export async function forgotPasswordAction(input: unknown): Promise<ActionResult<{ demoResetUrl?: string }>> {
  try {
    const data = forgotPasswordSchema.parse(input);
    const result = await getBackend().auth.requestPasswordReset(data.email);
    return { ok: true, data: result };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resetPasswordAction(input: unknown): Promise<ActionResult> {
  try {
    const data = resetPasswordSchema.parse(input);
    await getBackend().auth.completePasswordReset(data.password, data.token);
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function resendVerificationAction(input: unknown): Promise<ActionResult> {
  try {
    const data = forgotPasswordSchema.parse(input);
    await getBackend().auth.resendVerification(data.email);
    return { ok: true, data: undefined };
  } catch (error) {
    return toActionError(error);
  }
}

export async function acceptInvitationAction(token: string): Promise<ActionResult<{ redirectTo: string }>> {
  try {
    const user = await getSessionUser();
    if (!user) throw new UserFacingError("Log in to accept this invitation.");
    const backend = getBackend();
    const workspaceId = await backend.acceptInvitation(z.string().min(10).max(200).parse(token), user);
    (await cookies()).set(WORKSPACE_COOKIE, workspaceId, { path: "/", sameSite: "lax", httpOnly: true, maxAge: 31_536_000 });
    const db = await backend.db();
    const profile = await db.first("profiles", { eq: { id: user.id } });
    await db.insert("activity_logs", {
      workspace_id: workspaceId,
      actor_id: user.id,
      action: "member.joined",
      entity_type: "member",
      entity_id: user.id,
      entity_name: profile?.full_name || user.email,
      metadata: {},
    });
    return { ok: true, data: { redirectTo: "/dashboard" } };
  } catch (error) {
    return toActionError(error);
  }
}
