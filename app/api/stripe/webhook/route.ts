import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { getBackend } from "@/lib/backend";
import { serverEnv } from "@/lib/env.server";
import { recordStripeInvoice, syncStripeSubscription } from "@/lib/services/billing";
import { getStripe } from "@/lib/stripe";

/**
 * Stripe webhook. Verifies the signature with STRIPE_WEBHOOK_SECRET, then mirrors
 * subscription and invoice state into Postgres using the service-role client.
 * Subscribe to: checkout.session.completed, customer.subscription.created|updated|deleted,
 * invoice.paid, invoice.payment_failed.
 */
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const admin = getBackend().adminDb();
  if (!stripe || !serverEnv.stripeWebhookSecret || !admin) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await request.text(), signature, serverEnv.stripeWebhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(String(session.subscription), { expand: ["default_payment_method"] });
          await syncStripeSubscription(admin, subscription);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = await stripe.subscriptions.retrieve(event.data.object.id, { expand: ["default_payment_method"] });
        await syncStripeSubscription(admin, subscription);
        break;
      }
      case "invoice.paid":
      case "invoice.payment_failed":
        await recordStripeInvoice(admin, event.data.object);
        break;
      default:
        break;
    }
  } catch (error) {
    console.error("[stripe] webhook handling failed", event.type, error);
    // A 500 makes Stripe retry later.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
