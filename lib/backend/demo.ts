import "server-only";
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies, headers } from "next/headers";
import { demoDb } from "@/lib/db/demo/adapter";
import { demoStorageDir, mutateDemoState, readDemoState, type DemoState } from "@/lib/db/demo/store";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import { slugify } from "@/lib/format";
import type { NotificationPrefs, SubscriptionRow, WorkspaceMemberRow, WorkspaceRow } from "@/types/database";
import {
  UserFacingError,
  type AuthProvider,
  type Backend,
  type SessionInfo,
  type SessionUser,
  type StorageProvider,
} from "./types";

export const DEMO_SESSION_COOKIE = "fp_demo_session";
const SESSION_DAYS = 30;

const sign = (value: string) => createHmac("sha256", serverEnv.demoSessionSecret).update(value).digest("base64url");
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function encodeSession(id: string) {
  return `${id}.${sign(id)}`;
}

function decodeSession(raw: string | undefined): string | null {
  if (!raw) return null;
  const [id, signature] = raw.split(".");
  if (!id || !signature) return null;
  const expected = Buffer.from(sign(id));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual) ? id : null;
}

async function setSessionCookie(sessionId: string) {
  (await cookies()).set(DEMO_SESSION_COOKIE, encodeSession(sessionId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

async function currentSessionId(): Promise<string | null> {
  return decodeSession((await cookies()).get(DEMO_SESSION_COOKIE)?.value);
}

function createSession(state: DemoState, userId: string, userAgent: string): string {
  const now = new Date();
  state.auth.sessions = state.auth.sessions.filter((s) => new Date(s.expires_at) > now);
  const session = {
    id: randomUUID(),
    user_id: userId,
    user_agent: userAgent.slice(0, 300),
    created_at: now.toISOString(),
    last_seen_at: now.toISOString(),
    expires_at: new Date(now.getTime() + SESSION_DAYS * 86_400_000).toISOString(),
  };
  state.auth.sessions.push(session);
  return session.id;
}

async function userAgent(): Promise<string> {
  return (await headers()).get("user-agent") ?? "Unknown device";
}

const defaultPrefs: NotificationPrefs = { email: true, invoices: true, tasks: true, weekly_report: false };

function bootstrapWorkspace(state: DemoState, userId: string, name: string, industry: string | null): string {
  const now = new Date();
  const iso = now.toISOString();
  const trimmed = name.trim() || "My workspace";
  const workspace: WorkspaceRow = {
    id: randomUUID(),
    name: trimmed,
    slug: `${slugify(trimmed).slice(0, 40)}-${randomBytes(3).toString("hex")}`,
    logo_url: null,
    industry,
    team_size: null,
    primary_goal: null,
    onboarding_completed: false,
    created_by: userId,
    created_at: iso,
    updated_at: iso,
  };
  const member: WorkspaceMemberRow = {
    id: randomUUID(),
    workspace_id: workspace.id,
    user_id: userId,
    role: "owner",
    created_at: iso,
    updated_at: iso,
  };
  const trialEnd = new Date(now.getTime() + 14 * 86_400_000).toISOString();
  const subscription: SubscriptionRow = {
    id: randomUUID(),
    workspace_id: workspace.id,
    plan: "pro",
    status: "trialing",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    stripe_price_id: null,
    current_period_end: trialEnd,
    trial_end: trialEnd,
    cancel_at_period_end: false,
    payment_method_brand: null,
    payment_method_last4: null,
    created_at: iso,
    updated_at: iso,
  };
  state.tables.workspaces.push(workspace);
  state.tables.workspace_members.push(member);
  state.tables.subscriptions.push(subscription);
  return workspace.id;
}

const demoAuth: AuthProvider = {
  async getSessionUser(): Promise<SessionUser | null> {
    const sessionId = await currentSessionId();
    if (!sessionId) return null;
    const state = readDemoState();
    const session = state.auth.sessions.find((s) => s.id === sessionId);
    if (!session || new Date(session.expires_at) <= new Date()) return null;
    const user = state.auth.users.find((u) => u.id === session.user_id);
    if (!user) return null;
    if (Date.now() - new Date(session.last_seen_at).getTime() > 5 * 60_000) {
      mutateDemoState((s) => {
        const target = s.auth.sessions.find((x) => x.id === sessionId);
        if (target) target.last_seen_at = new Date().toISOString();
        const profile = s.tables.profiles.find((p) => p.id === user.id);
        if (profile) profile.last_active_at = new Date().toISOString();
      });
    }
    return { id: user.id, email: user.email, emailVerified: user.email_verified };
  },

  async signUp({ email, password, fullName, workspaceName }) {
    const normalized = email.trim().toLowerCase();
    const agent = await userAgent();
    const sessionId = mutateDemoState((state) => {
      if (state.auth.users.some((u) => u.email === normalized)) {
        throw new UserFacingError("An account with this email already exists. Try logging in instead.");
      }
      const id = randomUUID();
      const now = new Date().toISOString();
      state.auth.users.push({ id, email: normalized, password_hash: hashPassword(password), email_verified: true, created_at: now });
      state.tables.profiles.push({
        id,
        email: normalized,
        full_name: fullName.trim(),
        avatar_url: null,
        job_title: null,
        notification_prefs: defaultPrefs,
        last_active_at: now,
        created_at: now,
        updated_at: now,
      });
      bootstrapWorkspace(state, id, workspaceName, null);
      return createSession(state, id, agent);
    });
    await setSessionCookie(sessionId);
    return { status: "signed_in" };
  },

  async signIn(email, password) {
    const normalized = email.trim().toLowerCase();
    const user = readDemoState().auth.users.find((u) => u.email === normalized);
    if (!user || !verifyPassword(password, user.password_hash)) {
      throw new UserFacingError("Incorrect email or password.");
    }
    const agent = await userAgent();
    const sessionId = mutateDemoState((state) => {
      const profile = state.tables.profiles.find((p) => p.id === user.id);
      if (profile) profile.last_active_at = new Date().toISOString();
      return createSession(state, user.id, agent);
    });
    await setSessionCookie(sessionId);
  },

  async signOut() {
    const sessionId = await currentSessionId();
    if (sessionId) {
      mutateDemoState((state) => {
        state.auth.sessions = state.auth.sessions.filter((s) => s.id !== sessionId);
      });
    }
    (await cookies()).delete(DEMO_SESSION_COOKIE);
  },

  async resendVerification() {
    // Demo accounts are verified at signup; nothing to send.
  },

  async requestPasswordReset(email) {
    const normalized = email.trim().toLowerCase();
    const user = readDemoState().auth.users.find((u) => u.email === normalized);
    if (!user) return {};
    const token = randomBytes(32).toString("base64url");
    mutateDemoState((state) => {
      state.auth.resetTokens = state.auth.resetTokens.filter((t) => t.user_id !== user.id);
      state.auth.resetTokens.push({
        token_hash: hashToken(token),
        user_id: user.id,
        expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      });
    });
    return { demoResetUrl: `${publicEnv.appUrl}/reset-password?token=${token}` };
  },

  async completePasswordReset(password, token) {
    if (!token) throw new UserFacingError("This reset link is invalid. Request a new one.");
    const tokenHash = hashToken(token);
    mutateDemoState((state) => {
      const entry = state.auth.resetTokens.find((t) => t.token_hash === tokenHash);
      if (!entry || new Date(entry.expires_at) <= new Date()) {
        throw new UserFacingError("This reset link has expired. Request a new one.");
      }
      const user = state.auth.users.find((u) => u.id === entry.user_id);
      if (!user) throw new UserFacingError("This reset link is invalid. Request a new one.");
      user.password_hash = hashPassword(password);
      state.auth.resetTokens = state.auth.resetTokens.filter((t) => t !== entry);
      // Resetting a password signs out every existing session.
      state.auth.sessions = state.auth.sessions.filter((s) => s.user_id !== user.id);
    });
  },

  async changePassword(currentPassword, newPassword) {
    const sessionUser = await demoAuth.getSessionUser();
    if (!sessionUser) throw new UserFacingError("Your session has expired. Please log in again.");
    const sessionId = await currentSessionId();
    mutateDemoState((state) => {
      const user = state.auth.users.find((u) => u.id === sessionUser.id);
      if (!user || !verifyPassword(currentPassword, user.password_hash)) {
        throw new UserFacingError("Your current password is incorrect.");
      }
      user.password_hash = hashPassword(newPassword);
      state.auth.sessions = state.auth.sessions.filter((s) => s.user_id !== user.id || s.id === sessionId);
    });
  },

  async updateEmail(newEmail) {
    const sessionUser = await demoAuth.getSessionUser();
    if (!sessionUser) throw new UserFacingError("Your session has expired. Please log in again.");
    const normalized = newEmail.trim().toLowerCase();
    mutateDemoState((state) => {
      if (state.auth.users.some((u) => u.email === normalized && u.id !== sessionUser.id)) {
        throw new UserFacingError("That email address is already in use.");
      }
      const user = state.auth.users.find((u) => u.id === sessionUser.id);
      const profile = state.tables.profiles.find((p) => p.id === sessionUser.id);
      if (user) user.email = normalized;
      if (profile) profile.email = normalized;
    });
    return { pendingConfirmation: false };
  },

  async listSessions(): Promise<SessionInfo[]> {
    const sessionUser = await demoAuth.getSessionUser();
    if (!sessionUser) return [];
    const currentId = await currentSessionId();
    return readDemoState()
      .auth.sessions.filter((s) => s.user_id === sessionUser.id && new Date(s.expires_at) > new Date())
      .sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))
      .map((s) => ({
        id: s.id,
        current: s.id === currentId,
        userAgent: s.user_agent,
        createdAt: s.created_at,
        lastSeenAt: s.last_seen_at,
      }));
  },

  async revokeOtherSessions() {
    const sessionUser = await demoAuth.getSessionUser();
    const currentId = await currentSessionId();
    if (!sessionUser) return;
    mutateDemoState((state) => {
      state.auth.sessions = state.auth.sessions.filter((s) => s.user_id !== sessionUser.id || s.id === currentId);
    });
  },

  async deleteUser(userId) {
    mutateDemoState((state) => {
      state.auth.users = state.auth.users.filter((u) => u.id !== userId);
      state.auth.sessions = state.auth.sessions.filter((s) => s.user_id !== userId);
    });
    await demoDb.remove("profiles", { eq: { id: userId } });
    (await cookies()).delete(DEMO_SESSION_COOKIE);
  },
};

function safeJoin(root: string, objectPath: string): string {
  const target = path.resolve(root, objectPath);
  if (!target.startsWith(path.resolve(root) + path.sep)) throw new Error("Invalid storage path");
  return target;
}

const demoStorage: StorageProvider = {
  async uploadPrivate(objectPath, body) {
    const target = safeJoin(path.join(demoStorageDir(), "workspace-files"), objectPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
  },
  async downloadPrivate(objectPath) {
    const target = safeJoin(path.join(demoStorageDir(), "workspace-files"), objectPath);
    if (!fs.existsSync(target)) return null;
    return { body: fs.readFileSync(target), contentType: "application/octet-stream" };
  },
  async removePrivate(paths) {
    for (const p of paths) {
      fs.rmSync(safeJoin(path.join(demoStorageDir(), "workspace-files"), p), { force: true });
    }
  },
  async uploadPublic(objectPath, body) {
    const target = safeJoin(path.join(demoStorageDir(), "public-assets"), objectPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body);
    return `/api/storage/public/${objectPath}?v=${Date.now()}`;
  },
};

export function readDemoPublicAsset(objectPath: string): Buffer | null {
  try {
    const target = safeJoin(path.join(demoStorageDir(), "public-assets"), objectPath);
    return fs.existsSync(target) ? fs.readFileSync(target) : null;
  } catch {
    return null;
  }
}

export const demoBackend: Backend = {
  mode: "demo",
  auth: demoAuth,
  db: async () => demoDb,
  adminDb: () => demoDb,
  storage: async () => demoStorage,

  async createWorkspace(userId, name, industry) {
    return mutateDemoState((state) => bootstrapWorkspace(state, userId, name, industry ?? null));
  },

  async acceptInvitation(token, user) {
    return mutateDemoState((state) => {
      const invitation = state.tables.workspace_invitations.find(
        (i) => i.token === token && !i.accepted_at && new Date(i.expires_at) > new Date(),
      );
      if (!invitation) throw new UserFacingError("This invitation is invalid or has expired.");
      if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
        throw new UserFacingError("This invitation was sent to a different email address.");
      }
      const now = new Date().toISOString();
      if (!state.tables.workspace_members.some((m) => m.workspace_id === invitation.workspace_id && m.user_id === user.id)) {
        state.tables.workspace_members.push({
          id: randomUUID(),
          workspace_id: invitation.workspace_id,
          user_id: user.id,
          role: invitation.role,
          created_at: now,
          updated_at: now,
        });
      }
      invitation.accepted_at = now;
      invitation.updated_at = now;
      return invitation.workspace_id;
    });
  },

  async getInvitation(token) {
    const state = readDemoState();
    const invitation = state.tables.workspace_invitations.find((i) => i.token === token);
    if (!invitation) return null;
    const workspace = state.tables.workspaces.find((w) => w.id === invitation.workspace_id);
    return {
      workspaceName: workspace?.name ?? "a workspace",
      email: invitation.email,
      role: invitation.role,
      expired: new Date(invitation.expires_at) <= new Date(),
      accepted: !!invitation.accepted_at,
    };
  },
};

