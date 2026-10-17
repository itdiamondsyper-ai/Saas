import "server-only";
import { randomUUID } from "node:crypto";
import { getBackend } from "@/lib/backend";
import type { WorkspaceContext } from "@/lib/server/context";
import { NotFoundError, UserFacingError } from "@/lib/server/errors";
import { logActivity } from "./activity";

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

const BLOCKED_EXTENSIONS = /\.(exe|bat|cmd|com|msi|scr|ps1|sh|js|mjs|jar|vbs|dll|app)$/i;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Strips path separators and control characters from an uploaded file name. */
export function safeFileName(name: string) {
  const cleaned = name.replace(/[/\\?%*:|"<>\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim();
  return cleaned.slice(-120) || "file";
}

export async function uploadFile(ctx: WorkspaceContext, target: { clientId?: string | null; projectId?: string | null }, file: File) {
  if (!target.clientId && !target.projectId) throw new UserFacingError("Choose where to attach the file.");
  if (file.size === 0) throw new UserFacingError("That file is empty.");
  if (file.size > MAX_FILE_BYTES) throw new UserFacingError("Files must be 10 MB or smaller.");
  const name = safeFileName(file.name);
  if (BLOCKED_EXTENSIONS.test(name)) throw new UserFacingError("Executable files can't be uploaded.");

  let clientId = target.clientId ?? null;
  if (target.projectId) {
    const project = await ctx.db.first("projects", { eq: { id: target.projectId, workspace_id: ctx.workspace.id } });
    if (!project) throw new NotFoundError("That project doesn't exist.");
    clientId = clientId ?? project.client_id;
  }
  if (clientId) {
    const client = await ctx.db.first("clients", { eq: { id: clientId, workspace_id: ctx.workspace.id } });
    if (!client) throw new NotFoundError("That client doesn't exist.");
  }

  const id = randomUUID();
  const storagePath = `${ctx.workspace.id}/${target.projectId ? "projects" : "clients"}/${id}-${name}`;
  const contentType = file.type || "application/octet-stream";
  const storage = await getBackend().storage();
  await storage.uploadPrivate(storagePath, Buffer.from(await file.arrayBuffer()), contentType);
  try {
    const row = await ctx.db.insert("files", {
      workspace_id: ctx.workspace.id,
      client_id: clientId,
      project_id: target.projectId ?? null,
      name,
      size_bytes: file.size,
      mime_type: contentType,
      storage_path: storagePath,
      uploaded_by: ctx.user.id,
    });
    await logActivity(ctx, "file.uploaded", { type: "file", id: row.id, name });
    return row;
  } catch (error) {
    await storage.removePrivate([storagePath]);
    throw error;
  }
}

export async function deleteFile(ctx: WorkspaceContext, id: string) {
  const file = await ctx.db.first("files", { eq: { id, workspace_id: ctx.workspace.id } });
  if (!file) throw new NotFoundError("That file was already deleted.");
  await ctx.db.remove("files", { eq: { id, workspace_id: ctx.workspace.id } });
  await (await getBackend().storage()).removePrivate([file.storage_path]);
  await logActivity(ctx, "file.deleted", { type: "file", id: null, name: file.name });
  return file;
}

export async function getFileForDownload(ctx: WorkspaceContext, id: string) {
  const file = await ctx.db.first("files", { eq: { id, workspace_id: ctx.workspace.id } });
  if (!file) return null;
  const object = await (await getBackend().storage()).downloadPrivate(file.storage_path);
  if (!object) return null;
  return { file, body: object.body };
}

export async function uploadPublicImage(path: string, file: File) {
  if (!IMAGE_TYPES.includes(file.type)) throw new UserFacingError("Upload a PNG, JPG, WebP or GIF image.");
  if (file.size > MAX_IMAGE_BYTES) throw new UserFacingError("Images must be 2 MB or smaller.");
  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  return (await getBackend().storage()).uploadPublic(`${path}.${ext}`, Buffer.from(await file.arrayBuffer()), file.type);
}
