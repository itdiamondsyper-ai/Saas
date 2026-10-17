import type { Db } from "@/lib/db/types";
import type { WorkspaceRole } from "@/types/database";

export interface SessionUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

export interface SessionInfo {
  id: string;
  current: boolean;
  userAgent: string;
  createdAt: string | null;
  lastSeenAt: string | null;
}

export interface SignUpInput {
  email: string;
  password: string;
  fullName: string;
  workspaceName: string;
}

/** An error whose message is safe to show to the user. */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

export interface AuthProvider {
  getSessionUser(): Promise<SessionUser | null>;
  signUp(input: SignUpInput): Promise<{ status: "signed_in" | "verify_email" }>;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  resendVerification(email: string): Promise<void>;
  /** Returns a reset link only in demo mode, where no email can be sent. */
  requestPasswordReset(email: string): Promise<{ demoResetUrl?: string }>;
  /** Completes a reset. Demo mode passes the token; Supabase uses the recovery session. */
  completePasswordReset(password: string, token?: string): Promise<void>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;
  updateEmail(newEmail: string): Promise<{ pendingConfirmation: boolean }>;
  listSessions(): Promise<SessionInfo[]>;
  revokeOtherSessions(): Promise<void>;
  /** Permanently deletes the auth user. Callers clean up owned workspaces first. */
  deleteUser(userId: string): Promise<void>;
}

export interface InvitationPreview {
  workspaceName: string;
  email: string;
  role: WorkspaceRole;
  expired: boolean;
  accepted: boolean;
}

export interface StorageProvider {
  /** Private, workspace-scoped objects. */
  uploadPrivate(path: string, body: Buffer, contentType: string): Promise<void>;
  downloadPrivate(path: string): Promise<{ body: Buffer; contentType: string } | null>;
  removePrivate(paths: string[]): Promise<void>;
  /** Public assets (avatars, logos). Returns a URL the browser can load. */
  uploadPublic(path: string, body: Buffer, contentType: string): Promise<string>;
}

/** Everything that differs between Supabase mode and demo mode. */
export interface Backend {
  mode: "supabase" | "demo";
  auth: AuthProvider;
  /** Data access as the current user (RLS applies in Supabase mode). */
  db(): Promise<Db>;
  /** Service-level access that bypasses RLS. Null when it isn't configured. */
  adminDb(): Db | null;
  storage(): Promise<StorageProvider>;
  createWorkspace(userId: string, name: string, industry?: string | null): Promise<string>;
  acceptInvitation(token: string, user: SessionUser): Promise<string>;
  getInvitation(token: string): Promise<InvitationPreview | null>;
}
