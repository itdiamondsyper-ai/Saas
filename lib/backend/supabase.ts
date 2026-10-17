import "server-only";
import { headers } from "next/headers";
import { createSupabaseDb } from "@/lib/db/supabase/adapter";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import type { WorkspaceRole } from "@/types/database";
import { UserFacingError, type AuthProvider, type Backend, type SessionUser, type StorageProvider } from "./types";

const PRIVATE_BUCKET = "workspace-files";
const PUBLIC_BUCKET = "public-assets";

function friendlyAuthError(error: { message: string; code?: string; status?: number }): UserFacingError {
  const code = error.code ?? "";
  if (code === "invalid_credentials") return new UserFacingError("Incorrect email or password.");
  if (code === "email_not_confirmed") {
    return new UserFacingError("Please confirm your email address first. Check your inbox for the verification link.");
  }
  if (code === "user_already_exists" || code === "email_exists") {
    return new UserFacingError("An account with this email already exists. Try logging in instead.");
  }
  if (code === "weak_password") return new UserFacingError("That password is too weak. Use at least 8 characters.");
  if (code === "over_email_send_rate_limit" || error.status === 429) {
    return new UserFacingError("Too many attempts. Please wait a minute and try again.");
  }
  if (code === "same_password") return new UserFacingError("Choose a password you haven't used before.");
  return new UserFacingError("Something went wrong with authentication. Please try again.");
}

const supabaseAuth: AuthProvider = {
  async getSessionUser(): Promise<SessionUser | null> {
    const supabase = await createSupabaseServerClient();
    // getUser() validates the JWT with Supabase Auth instead of trusting the cookie.
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? "", emailVerified: !!data.user.email_confirmed_at };
  },

  async signUp({ email, password, fullName, workspaceName }) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, workspace_name: workspaceName },
        emailRedirectTo: `${publicEnv.appUrl}/auth/confirm?next=/onboarding`,
      },
    });
    if (error) throw friendlyAuthError(error);
    // Supabase returns a user with no identities when the email is already registered.
    if (data.user && data.user.identities?.length === 0) {
      throw new UserFacingError("An account with this email already exists. Try logging in instead.");
    }
    return { status: data.session ? "signed_in" : "verify_email" };
  },

  async signIn(email, password) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw friendlyAuthError(error);
  },

  async signOut() {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  },

  async resendVerification(email) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${publicEnv.appUrl}/auth/confirm?next=/onboarding` },
    });
    if (error) throw friendlyAuthError(error);
  },

  async requestPasswordReset(email) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${publicEnv.appUrl}/auth/confirm?next=/reset-password`,
    });
    // Don't reveal whether the email exists; only surface rate limits.
    if (error && error.status === 429) throw friendlyAuthError(error);
    return {};
  },

  async completePasswordReset(password) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new UserFacingError("This reset link has expired. Request a new one.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw friendlyAuthError(error);
  },

  async changePassword(currentPassword, newPassword) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user?.email) throw new UserFacingError("Your session has expired. Please log in again.");
    const check = await supabase.auth.signInWithPassword({ email: data.user.email, password: currentPassword });
    if (check.error) throw new UserFacingError("Your current password is incorrect.");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw friendlyAuthError(error);
  },

  async updateEmail(newEmail) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${publicEnv.appUrl}/auth/confirm?next=/dashboard/settings` },
    );
    if (error) throw friendlyAuthError(error);
    return { pendingConfirmation: true };
  },

  async listSessions() {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return [];
    // Supabase does not expose other sessions to clients; show the current one.
    return [
      {
        id: "current",
        current: true,
        userAgent: (await headers()).get("user-agent") ?? "Unknown device",
        createdAt: data.user.last_sign_in_at ?? null,
        lastSeenAt: new Date().toISOString(),
      },
    ];
  },

  async revokeOtherSessions() {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) throw friendlyAuthError(error);
  },

  async deleteUser(userId) {
    if (!serverEnv.supabaseServiceRoleKey) {
      throw new UserFacingError("Account deletion isn't configured on this server. Contact support to delete your account.");
    }
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw new UserFacingError("We couldn't delete your account. Please try again or contact support.");
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  },
};

async function supabaseStorage(): Promise<StorageProvider> {
  const supabase = await createSupabaseServerClient();
  return {
    async uploadPrivate(path, body, contentType) {
      const { error } = await supabase.storage.from(PRIVATE_BUCKET).upload(path, body, { contentType, upsert: false });
      if (error) throw new UserFacingError("The file couldn't be uploaded. Please try again.");
    },
    async downloadPrivate(path) {
      const { data, error } = await supabase.storage.from(PRIVATE_BUCKET).download(path);
      if (error || !data) return null;
      return { body: Buffer.from(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
    },
    async removePrivate(paths) {
      if (paths.length) await supabase.storage.from(PRIVATE_BUCKET).remove(paths);
    },
    async uploadPublic(path, body, contentType) {
      const { error } = await supabase.storage.from(PUBLIC_BUCKET).upload(path, body, { contentType, upsert: true });
      if (error) throw new UserFacingError("The image couldn't be uploaded. Please try again.");
      const { data } = supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path);
      return `${data.publicUrl}?v=${Date.now()}`;
    },
  };
}

export const supabaseBackend: Backend = {
  mode: "supabase",
  auth: supabaseAuth,
  db: async () => createSupabaseDb(await createSupabaseServerClient()),
  adminDb: () => (serverEnv.supabaseServiceRoleKey ? createSupabaseDb(createSupabaseAdminClient()) : null),
  storage: supabaseStorage,

  async createWorkspace(_userId, name, industry) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("create_workspace", { p_name: name, p_industry: industry ?? null });
    if (error) throw new UserFacingError("We couldn't create the workspace. Please try again.");
    return data as string;
  },

  async acceptInvitation(token) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
    if (error) {
      const message = error.message.includes("different email")
        ? "This invitation was sent to a different email address."
        : "This invitation is invalid or has expired.";
      throw new UserFacingError(message);
    }
    return data as string;
  },

  async getInvitation(token) {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("get_invitation", { p_token: token });
    const row = (data as { workspace_name: string; email: string; role: WorkspaceRole; expired: boolean; accepted: boolean }[] | null)?.[0];
    if (error || !row) return null;
    return { workspaceName: row.workspace_name, email: row.email, role: row.role, expired: row.expired, accepted: row.accepted };
  },
};
