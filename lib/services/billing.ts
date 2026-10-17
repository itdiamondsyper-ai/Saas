import "server-only";
import type Stripe from "stripe";
import { getBackend } from "@/lib/backend";
import type { Db } from "@/lib/db/types";
import { publicEnv } from "@/lib/env";
import { isStripeConfigured } from "@/lib/env.server";
import { PLANS } from "@/lib/plans";
import type { WorkspaceContext } from "@/lib/server/context";
import { UserFacingError } from "@/lib/server/errors";
import { getStripe, planForPriceId, priceIdForPlan } from "@/lib/stripe";
import type { PlanTier, SubscriptionRow, SubscriptionStatus } from "@/types/database";
import { logActivity } from "./activity";
import { listMembers } from "./members";

export type BillingMode = "stripe" | "simulated" | "unavailable";

export function billingMode(): BillingMode {
  if (isStripeConfigured() && getBackend().mode === "supabase") return "stripe";
  if (getBackend().mode === "demo") return "simulated";
  return "unavailable";
}

export async function getBillingOverview(ctx: WorkspaceContext) {
  const { rows: history } = await ctx.db.select("billing_history", {
    eq: { workspace_id: ctx.workspace.id },
    order: [{ column: "created_at", ascending: false }],
    limit: 24,
  });
  const members = await listMembers(ctx);
  return { subscription: ctx.subscription, plan: ctx.plan, history, mode: billingMode(), seatsUsed: members.length };
}

async function assertDowngradeFits(ctx: WorkspaceContext, plan: PlanTier) {
  const limits = PLANS[plan].limits;
  const members = await listMembers(ctx);
  if (members.length > limits.users) {
    throw new UserFacingError(
      `${PLANS[plan].name} allows ${limits.users} ${limits.users === 1 ? "user" : "users"}, and this workspace has ${members.length}. Remove members before downgrading.`,
    );
  }
}

/** Demo mode: apply the plan change immediately so the full billing UI can be exercised. */
async function simulatePlanChange(ctx: WorkspaceContext, plan: PlanTier) {
  const db = getBackend().adminDb();
  if (!db) throw new UserFacingError("Billing isn't configured on this server.");
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const patch: Partial<SubscriptionRow> = {
    plan,
    status: "active",
    trial_end: null,
    current_period_end: plan === "starter" ? null : periodEnd,
    cancel_at_period_end: false,
    payment_method_brand: plan === "starter" ? ctx.subscription?.payment_method_brand ?? null : ctx.subscription?.payment_method_brand ?? "visa",
    payment_method_last4: plan === "starter" ? ctx.subscription?.payment_method_last4 ?? null : ctx.subscription?.payment_method_last4 ?? "4242",
  };
  if (ctx.subscription) {
    await db.update("subscriptions", { eq: { workspace_id: ctx.workspace.id } }, patch);
  } else {
    await db.insert("subscriptions", {
      workspace_id: ctx.workspace.id,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      stripe_price_id: null,
      plan,
      status: "active",
      trial_end: null,
      current_period_end: patch.current_period_end ?? null,
      cancel_at_period_end: false,
      payment_method_brand: patch.payment_method_brand ?? null,
      payment_method_last4: patch.payment_method_last4 ?? null,
    });
  }
  if (PLANS[plan].price > 0) {
    await db.insert("billing_history", {
      workspace_id: ctx.workspace.id,
      stripe_invoice_id: null,
      description: `FlowPilot ${PLANS[plan].name} · monthly (demo)`,
      amount: PLANS[plan].price,
      currency: "USD",
      status: "paid",
      invoice_url: null,
    });
  }
}

export type PlanChangeResult = { kind: "redirect"; url: string } | { kind: "updated" };

export async function changePlan(ctx: WorkspaceContext, plan: PlanTier): Promise<PlanChangeResult> {
  const current = ctx.subscription?.status === "trialing" ? null : ctx.plan;
  if (current === plan) throw new UserFacingError(`You're already on the ${PLANS[plan].name} plan.`);
  await assertDowngradeFits(ctx, plan);

  const mode = billingMode();
  if (mode === "simulated") {
    await simulatePlanChange(ctx, plan);
    await logActivity(ctx, "billing.plan_changed", { type: "workspace", id: ctx.workspace.id, name: ctx.workspace.name }, { plan: PLANS[plan].name });
    return { kind: "updated" };
  }
  if (mode === "unavailable") {
    throw new UserFacingError("Billing isn't configured yet. Add your Stripe keys to enable plan changes.");
  }
  // Paid subscribers change or cancel plans in the Stripe billing portal.
  if (ctx.subscription?.stripe_subscription_id) return { kind: "redirect", url: await createPortalSession(ctx) };
  if (plan === "starter") throw new UserFacingError("You're not on a paid plan.");
  return { kind: "redirect", url: await createCheckoutSession(ctx, plan) };
}

async function ensureCustomer(ctx: WorkspaceContext, stripe: Stripe, admin: Db): Promise<string> {
  if (ctx.subscription?.stripe_customer_id) return ctx.subscription.stripe_customer_id;
  const customer = await stripe.customers.create({
    email: ctx.profile.email,
    name: ctx.workspace.name,
    metadata: { workspace_id: ctx.workspace.id },
  });
  await admin.update("subscriptions", { eq: { workspace_id: ctx.workspace.id } }, { stripe_customer_id: customer.id });
  return customer.id;
}

export async function createCheckoutSession(ctx: WorkspaceContext, plan: Exclude<PlanTier, "starter">) {
  const stripe = getStripe();
  const admin = getBackend().adminDb();
  if (!stripe || !admin) throw new UserFacingError("Billing isn't configured yet.");
  const customer = await ensureCustomer(ctx, stripe, admin);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: priceIdForPlan(plan), quantity: 1 }],
    client_reference_id: ctx.workspace.id,
    subscription_data: { metadata: { workspace_id: ctx.workspace.id } },
    metadata: { workspace_id: ctx.workspace.id },
    allow_promotion_codes: true,
    success_url: `${publicEnv.appUrl}/dashboard/settings?tab=billing&checkout=success`,
    cancel_url: `${publicEnv.appUrl}/dashboard/settings?tab=billing&checkout=cancelled`,
  });
  if (!session.url) throw new UserFacingError("Stripe didn't return a checkout link. Please try again.");
  return session.url;
}

export async function createPortalSession(ctx: WorkspaceContext) {
  const stripe = getStripe();
  if (!stripe) throw new UserFacingError("Billing isn't configured yet.");
  const customer = ctx.subscription?.stripe_customer_id;
  if (!customer) throw new UserFacingError("There's no billing account for this workspace yet. Choose a paid plan first.");
  const session = await stripe.billingPortal.sessions.create({
    customer,
    return_url: `${publicEnv.appUrl}/dashboard/settings?tab=billing`,
  });
  return session.url;
}

function mapStatus(status: Stripe.Subscription.Status): SubscriptionStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "incomplete":
    case "incomplete_expired":
      return "incomplete";
    default:
      return "canceled";
  }
}

/** Webhook handler: mirrors Stripe subscription state into the subscriptions table. */
export async function syncStripeSubscription(admin: Db, subscription: Stripe.Subscription) {
  const workspaceId =
    subscription.metadata?.workspace_id ??
    (await admin.first("subscriptions", { eq: { stripe_customer_id: String(subscription.customer) } }))?.workspace_id;
  if (!workspaceId) return;
  const item = subscription.items.data[0];
  const priceId = item?.price.id ?? null;
  const status = mapStatus(subscription.status);
  const periodEnd = item?.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null;
  let brand: string | null = null;
  let last4: string | null = null;
  const pm = subscription.default_payment_method;
  if (pm && typeof pm !== "string" && pm.card) {
    brand = pm.card.brand;
    last4 = pm.card.last4;
  }
  await admin.update(
    "subscriptions",
    { eq: { workspace_id: workspaceId } },
    {
      plan: status === "canceled" ? "starter" : planForPriceId(priceId),
      status: status === "canceled" ? "active" : status,
      stripe_customer_id: String(subscription.customer),
      stripe_subscription_id: status === "canceled" ? null : subscription.id,
      stripe_price_id: priceId,
      current_period_end: periodEnd,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      ...(brand ? { payment_method_brand: brand, payment_method_last4: last4 } : {}),
    },
  );
}

export async function recordStripeInvoice(admin: Db, invoice: Stripe.Invoice) {
  const customer = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!customer || !invoice.id) return;
  const sub = await admin.first("subscriptions", { eq: { stripe_customer_id: customer } });
  if (!sub) return;
  const existing = await admin.first("billing_history", { eq: { stripe_invoice_id: invoice.id } });
  const values = {
    workspace_id: sub.workspace_id,
    stripe_invoice_id: invoice.id,
    description: invoice.lines.data[0]?.description ?? "FlowPilot subscription",
    amount: (invoice.amount_paid || invoice.amount_due) / 100,
    currency: invoice.currency.toUpperCase(),
    status: invoice.status ?? "open",
    invoice_url: invoice.hosted_invoice_url ?? null,
  };
  if (existing) await admin.update("billing_history", { eq: { id: existing.id } }, values);
  else await admin.insert("billing_history", values);
}
