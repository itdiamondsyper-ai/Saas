import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_NEXT = ["/onboarding", "/reset-password", "/dashboard", "/dashboard/settings"];

/**
 * Landing route for Supabase email links (signup confirmation, password recovery,
 * email change). Handles both the token-hash and PKCE code flows.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = ALLOWED_NEXT.includes(url.searchParams.get("next") ?? "") ? url.searchParams.get("next")! : "/dashboard";
  if (isDemoMode()) return NextResponse.redirect(new URL(next, request.url));

  const supabase = await createSupabaseServerClient();
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const code = url.searchParams.get("code");

  let ok = false;
  if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ type, token_hash: tokenHash })).error;
  } else if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  }
  if (!ok) return NextResponse.redirect(new URL("/login?error=link", request.url));
  return NextResponse.redirect(new URL(next, request.url));
}
