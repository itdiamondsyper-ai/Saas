// Central place for configuration. Only NEXT_PUBLIC_* values may reach the browser.

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  stripePublishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "",
  appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};

/**
 * Demo mode runs the whole app against a local JSON store with built-in auth.
 * It is on when Supabase isn't configured, or when FLOWPILOT_DEMO_MODE=true.
 */
export function isDemoMode(): boolean {
  if (process.env.FLOWPILOT_DEMO_MODE === "true") return true;
  if (process.env.FLOWPILOT_DEMO_MODE === "false") return false;
  return !publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey;
}
