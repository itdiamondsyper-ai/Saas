import { NextResponse, type NextRequest } from "next/server";
import { readDemoPublicAsset } from "@/lib/backend/demo";
import { isDemoMode } from "@/lib/env";

const TYPES: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

/** Demo mode only: serves avatars and logos uploaded to local storage. */
export async function GET(_request: NextRequest, { params }: RouteContext<"/api/storage/public/[...path]">) {
  if (!isDemoMode()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { path } = await params;
  const objectPath = path.join("/");
  if (!/^(users|workspaces)\/[0-9a-f-]{36}\/(avatar|logo)\.(png|jpg|webp|gif)$/.test(objectPath)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = readDemoPublicAsset(objectPath);
  if (!body) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(new Uint8Array(body), {
    headers: { "Content-Type": TYPES[objectPath.split(".").pop()!], "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
}
