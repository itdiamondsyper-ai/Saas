"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Download, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { uploadFileAction } from "@/lib/actions/account";
import { deleteFileAction } from "@/lib/actions/records";
import { formatBytes, formatRelative } from "@/lib/format";
import { ConfirmDialog } from "./confirm-dialog";
import { EmptyState } from "./empty-state";

export interface FileItem {
  id: string;
  name: string;
  size_bytes: number;
  created_at: string;
  uploader: { name: string } | null;
}

const MAX_BYTES = 10 * 1024 * 1024;

export function FilesPanel({ files, clientId, projectId, canWrite }: { files: FileItem[]; clientId?: string; projectId?: string; canWrite: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<FileItem | null>(null);
  const { run } = useAction();

  const upload = async (file: File) => {
    if (file.size > MAX_BYTES) {
      toast.error("Files must be 10 MB or smaller.");
      return;
    }
    const data = new FormData();
    data.set("file", file);
    if (clientId) data.set("clientId", clientId);
    if (projectId) data.set("projectId", projectId);
    setUploading(true);
    const result = await uploadFileAction(data).catch(() => ({ ok: false as const, error: "Upload failed. Check your connection and try again." }));
    setUploading(false);
    if (result.ok) {
      toast.success(`${file.name} uploaded`);
      router.refresh();
    } else toast.error(result.error);
  };

  return (
    <div className="space-y-3">
      {canWrite && (
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files[0];
            if (file) void upload(file);
          }}
          className="flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center"
        >
          <Paperclip className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">Drag a file here, or</p>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            aria-label="Upload file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void upload(file);
              e.target.value = "";
            }}
          />
          <Button variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />} Choose file
          </Button>
          <p className="text-xs text-muted-foreground">Up to 10 MB</p>
        </div>
      )}
      {files.length === 0 ? (
        !canWrite && <EmptyState icon={FileText} title="No files yet" compact />
      ) : (
        <ul className="divide-y rounded-lg border">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(f.size_bytes)} · {f.uploader?.name ?? "Someone"} · {formatRelative(f.created_at)}
                </p>
              </div>
              <a href={`/api/files/${f.id}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Download ${f.name}`}>
                <Download className="size-4" />
              </a>
              {canWrite && (
                <Button variant="ghost" size="icon-sm" aria-label={`Delete ${f.name}`} onClick={() => setDeleting(f)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this file?"
        description={`${deleting?.name ?? "The file"} will be permanently removed.`}
        confirmLabel="Delete file"
        destructive
        onConfirm={async () => {
          if (!deleting) return;
          const r = await run(() => deleteFileAction({ id: deleting.id }), { success: "File deleted" });
          if (r.ok) router.refresh();
          return r.ok;
        }}
      />
    </div>
  );
}
