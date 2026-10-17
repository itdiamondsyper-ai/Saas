import { NextResponse, type NextRequest } from "next/server";
import { getWorkspaceContext } from "@/lib/server/context";
import { getFileForDownload } from "@/lib/services/files";
import { uuid } from "@/lib/validation/common";

/** Streams a workspace file to members of that workspace only. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/files/[id]">) {
  const { id } = await params;
  if (!uuid.safeParse(id).success) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const result = await getFileForDownload(ctx, id);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(result.body), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(result.file.name)}`,
      "Content-Length": String(result.body.length),
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
