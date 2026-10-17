import { NextResponse } from "next/server";
import { connection } from "next/server";
import { isDemoMode } from "@/lib/env";
import { isStripeConfigured } from "@/lib/env.server";

/** Liveness probe. Reports configuration modes, never secrets. */
export async function GET() {
  await connection();
  return NextResponse.json({
    status: "ok",
    mode: isDemoMode() ? "demo" : "supabase",
    billing: isStripeConfigured() ? "stripe" : "not_configured",
    time: new Date().toISOString(),
  });
}
