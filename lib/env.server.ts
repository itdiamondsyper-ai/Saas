import "server-only";

// Server-only secrets. Importing this module from a Client Component fails the build.

export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePricePro: process.env.STRIPE_PRICE_PRO ?? "",
  stripePriceBusiness: process.env.STRIPE_PRICE_BUSINESS ?? "",
  demoSessionSecret: process.env.DEMO_SESSION_SECRET ?? "flowpilot-local-demo-secret-change-me",
  cronSecret: process.env.CRON_SECRET ?? "",
};

export function isStripeConfigured(): boolean {
  return !!serverEnv.stripeSecretKey && !!serverEnv.stripePricePro && !!serverEnv.stripePriceBusiness;
}
