"use server";

import { cookies } from "next/headers";
import { z } from "zod";
import { getBackend } from "@/lib/backend";
import { runAction } from "@/lib/server/action";
import { WORKSPACE_COOKIE } from "@/lib/server/context";
import { UserFacingError } from "@/lib/server/errors";
import { changePlan } from "@/lib/services/billing";
import { uploadFile } from "@/lib/services/files";
import { deleteNotification, markRead, markUnread } from "@/lib/services/notifications";
import { searchWorkspace } from "@/lib/services/search";
import { changeRole, inviteMember, leaveWorkspace, memberActivity, removeMember, revokeInvitation } from "@/lib/services/team";
import {
  deleteAccount,
  deleteWorkspace,
  removeAvatar,
  removeWorkspaceLogo,
  updateNotificationPrefs,
  updateProfile,
  updateWorkspace,
  uploadAvatar,
  uploadWorkspaceLogo,
} from "@/lib/services/workspace";
import { optionalUuid, uuid } from "@/lib/validation/common";
import {
  changePasswordSchema,
  changeRoleSchema,
  emailChangeSchema,
  inviteSchema,
  notificationPrefsSchema,
  planSchema,
  profileSchema,
  workspaceSettingsSchema,
} from "@/lib/validation/schemas";

const idOnly = z.object({ id: uuid });
const fileSchema = z.instanceof(File, { message: "Choose a file to upload" });

// --- Team -------------------------------------------------------------------

export async function inviteMemberAction(input: unknown) {
  return runAction(inviteSchema, input, { permission: "team:manage" }, async (ctx, d) => {
    const { link } = await inviteMember(ctx, d.email, d.role);
    return { link };
  });
}

export async function revokeInvitationAction(input: unknown) {
  return runAction(idOnly, input, { permission: "team:manage" }, (ctx, d) => revokeInvitation(ctx, d.id));
}

export async function changeRoleAction(input: unknown) {
  return runAction(changeRoleSchema, input, { permission: "team:manage" }, (ctx, d) => changeRole(ctx, d.userId, d.role));
}

export async function removeMemberAction(input: unknown) {
  return runAction(z.object({ userId: uuid }), input, { permission: "team:manage" }, (ctx, d) => removeMember(ctx, d.userId));
}

export async function memberActivityAction(input: unknown) {
  return runAction(z.object({ userId: uuid }), input, { revalidate: false }, (ctx, d) => memberActivity(ctx, d.userId));
}

export async function leaveWorkspaceAction() {
  return runAction(z.undefined(), undefined, {}, async (ctx) => {
    await leaveWorkspace(ctx);
    (await cookies()).delete(WORKSPACE_COOKIE);
  });
}

// --- Notifications ----------------------------------------------------------

export async function markNotificationsReadAction(input: unknown) {
  return runAction(z.object({ ids: z.union([z.array(uuid).max(200), z.literal("all")]) }), input, {}, (ctx, d) =>
    markRead(ctx, d.ids),
  );
}

export async function markNotificationUnreadAction(input: unknown) {
  return runAction(idOnly, input, {}, (ctx, d) => markUnread(ctx, d.id));
}

export async function deleteNotificationAction(input: unknown) {
  return runAction(idOnly, input, {}, (ctx, d) => deleteNotification(ctx, d.id));
}

// --- Search -----------------------------------------------------------------

export async function searchAction(input: unknown) {
  return runAction(z.object({ q: z.string().max(100) }), input, { revalidate: false }, (ctx, d) => searchWorkspace(ctx, d.q));
}

// --- Profile & security -----------------------------------------------------

export async function updateProfileAction(input: unknown) {
  return runAction(profileSchema, input, {}, (ctx, d) => updateProfile(ctx, d));
}

export async function changeEmailAction(input: unknown) {
  return runAction(emailChangeSchema, input, {}, async (ctx, d) => {
    if (d.email === ctx.user.email.toLowerCase()) throw new UserFacingError("That's already your email address.");
    return getBackend().auth.updateEmail(d.email);
  });
}

export async function uploadAvatarAction(formData: FormData) {
  return runAction(fileSchema, formData.get("file"), {}, (ctx, file) => uploadAvatar(ctx, file));
}

export async function removeAvatarAction() {
  return runAction(z.undefined(), undefined, {}, (ctx) => removeAvatar(ctx));
}

export async function updateNotificationPrefsAction(input: unknown) {
  return runAction(notificationPrefsSchema, input, {}, (ctx, d) => updateNotificationPrefs(ctx, d));
}

export async function changePasswordAction(input: unknown) {
  return runAction(changePasswordSchema, input, { revalidate: false }, (_ctx, d) =>
    getBackend().auth.changePassword(d.currentPassword, d.newPassword),
  );
}

export async function revokeOtherSessionsAction() {
  return runAction(z.undefined(), undefined, { revalidate: false }, () => getBackend().auth.revokeOtherSessions());
}

export async function deleteAccountAction(input: unknown) {
  return runAction(z.object({ confirmation: z.literal("DELETE", { error: "Type DELETE to confirm" }) }), input, { revalidate: false }, async (ctx) => {
    await deleteAccount(ctx);
    (await cookies()).delete(WORKSPACE_COOKIE);
  });
}

// --- Workspace settings -----------------------------------------------------

export async function updateWorkspaceAction(input: unknown) {
  return runAction(workspaceSettingsSchema, input, { permission: "workspace:update" }, async (ctx, d) => {
    await updateWorkspace(ctx, { name: d.name, industry: d.industry, teamSize: d.teamSize });
  });
}

export async function uploadLogoAction(formData: FormData) {
  return runAction(fileSchema, formData.get("file"), { permission: "workspace:update" }, (ctx, file) => uploadWorkspaceLogo(ctx, file));
}

export async function removeLogoAction() {
  return runAction(z.undefined(), undefined, { permission: "workspace:update" }, (ctx) => removeWorkspaceLogo(ctx));
}

export async function deleteWorkspaceAction(input: unknown) {
  return runAction(z.object({ confirmation: z.string() }), input, { permission: "workspace:delete" }, async (ctx, d) => {
    if (d.confirmation !== ctx.workspace.name) throw new UserFacingError("Type the workspace name exactly to confirm.");
    await deleteWorkspace(ctx);
    (await cookies()).delete(WORKSPACE_COOKIE);
  });
}

// --- Billing ----------------------------------------------------------------

export async function changePlanAction(input: unknown) {
  return runAction(planSchema, input, { permission: "billing:manage" }, (ctx, d) => changePlan(ctx, d.plan));
}

// --- Files ------------------------------------------------------------------

export async function uploadFileAction(formData: FormData) {
  const target = z
    .object({ clientId: optionalUuid, projectId: optionalUuid, file: fileSchema })
    .safeParse({
      clientId: formData.get("clientId") ?? "",
      projectId: formData.get("projectId") ?? "",
      file: formData.get("file"),
    });
  return runAction(z.any(), target, { permission: "records:write" }, async (ctx) => {
    if (!target.success) throw new UserFacingError(target.error.issues[0]?.message ?? "Invalid upload");
    const row = await uploadFile(ctx, target.data, target.data.file);
    return { id: row.id, name: row.name };
  });
}
