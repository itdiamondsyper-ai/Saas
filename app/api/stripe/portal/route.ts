import { NextResponse } from "next/server";
import { can } from "@/lib/permissions";
import { toActionError } from "@/lib/server/action";
import { getWorkspaceContext } from "@/lib/server/context";
import { billingMode, createPortalSession } from "@/lib/services/billing";

/** POST → { url } for the Stripe customer billing portal. Owners only. */
export async function POST() {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!can(ctx.role, "billing:manage")) return NextResponse.json({ error: "Only workspace owners can manage billing." }, { status: 403 });
  if (billingMode() !== "stripe") return NextResponse.json({ error: "Stripe isn't configured." }, { status: 503 });
  try {
    return NextResponse.json({ url: await createPortalSession(ctx) });
  } catch (error) {
    return NextResponse.json({ error: toActionError(error).error }, { status: 400 });
  }
}
