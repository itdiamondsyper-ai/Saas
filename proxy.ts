import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const DEMO_SESSION_COOKIE = "fp_demo_session";
const PROTECTED_PREFIXES = ["/dashboard", "/onboarding"];

function isDemoMode() {
  if (process.env.FLOWPILOT_DEMO_MODE === "true") return true;
  if (process.env.FLOWPILOT_DEMO_MODE === "false") return false;
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  const next = request.nextUrl.pathname + request.nextUrl.search;
  if (next !== "/dashboard") url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

/**
 * Optimistic route protection and Supabase session refresh. This is only a first
 * line of defense: every page and server action re-validates the session and
 * workspace membership on the server.
 */
export async function proxy(request: NextRequest) {
  const isProtected = PROTECTED_PREFIXES.some((p) => request.nextUrl.pathname.startsWith(p));

  if (isDemoMode()) {
    if (isProtected && !request.cookies.get(DEMO_SESSION_COOKIE)) return redirectToLogin(request);
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Refreshes the auth token if needed. Do not run code between client creation and this call.
  const { data } = await supabase.auth.getClaims();
  if (isProtected && !data?.claims) return redirectToLogin(request);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
