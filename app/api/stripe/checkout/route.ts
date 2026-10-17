import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { can } from "@/lib/permissions";
import { toActionError } from "@/lib/server/action";
import { getWorkspaceContext } from "@/lib/server/context";
import { billingMode, createCheckoutSession } from "@/lib/services/billing";

const bodySchema = z.object({ plan: z.enum(["pro", "business"]) });

/** POST { plan } → { url } for a Stripe Checkout session. Owners only. */
export async function POST(request: NextRequest) {
  const ctx = await getWorkspaceContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!can(ctx.role, "billing:manage")) return NextResponse.json({ error: "Only workspace owners can manage billing." }, { status: 403 });
  if (billingMode() !== "stripe") {
    return NextResponse.json({ error: "Stripe isn't configured. Set STRIPE_SECRET_KEY, STRIPE_PRICE_PRO and STRIPE_PRICE_BUSINESS." }, { status: 503 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose the Pro or Business plan." }, { status: 400 });
  try {
    return NextResponse.json({ url: await createCheckoutSession(ctx, parsed.data.plan) });
  } catch (error) {
    return NextResponse.json({ error: toActionError(error).error }, { status: 400 });
  }
}
