import "server-only";
import Stripe from "stripe";
import { isStripeConfigured, serverEnv } from "@/lib/env.server";
import type { PlanTier } from "@/types/database";

let client: Stripe | null = null;

/** Server-side Stripe client, or null when STRIPE_SECRET_KEY isn't set. */
export function getStripe(): Stripe | null {
  if (!isStripeConfigured()) return null;
  client ??= new Stripe(serverEnv.stripeSecretKey, { appInfo: { name: "FlowPilot" } });
  return client;
}

export function priceIdForPlan(plan: Exclude<PlanTier, "starter">): string {
  return plan === "pro" ? serverEnv.stripePricePro : serverEnv.stripePriceBusiness;
}

export function planForPriceId(priceId: string | null | undefined): PlanTier {
  if (priceId && priceId === serverEnv.stripePriceBusiness) return "business";
  if (priceId && priceId === serverEnv.stripePricePro) return "pro";
  return "starter";
}
