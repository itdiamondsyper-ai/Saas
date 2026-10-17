import type { PlanTier, SubscriptionRow } from "@/types/database";

export interface PlanDefinition {
  id: PlanTier;
  name: string;
  price: number;
  description: string;
  limits: { users: number; activeProjects: number; clients: number };
  features: string[];
  highlights: { advancedAnalytics: boolean; invoicing: boolean; automation: boolean; auditLogs: boolean; advancedPermissions: boolean };
}

const UNLIMITED = Number.POSITIVE_INFINITY;

export const PLANS: Record<PlanTier, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    price: 0,
    description: "For freelancers getting organized.",
    limits: { users: 1, activeProjects: 3, clients: 10 },
    features: ["1 user", "3 active projects", "10 clients", "Basic analytics"],
    highlights: { advancedAnalytics: false, invoicing: true, automation: false, auditLogs: false, advancedPermissions: false },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 19,
    description: "For growing studios and small teams.",
    limits: { users: 5, activeProjects: UNLIMITED, clients: UNLIMITED },
    features: ["5 users", "Unlimited projects", "Unlimited clients", "Advanced analytics", "Invoice management", "Automation"],
    highlights: { advancedAnalytics: true, invoicing: true, automation: true, auditLogs: false, advancedPermissions: false },
  },
  business: {
    id: "business",
    name: "Business",
    price: 49,
    description: "For established teams that need control.",
    limits: { users: 20, activeProjects: UNLIMITED, clients: UNLIMITED },
    features: ["20 users", "Advanced permissions", "Audit logs", "Priority support", "Advanced reporting", "Everything in Pro"],
    highlights: { advancedAnalytics: true, invoicing: true, automation: true, auditLogs: true, advancedPermissions: true },
  },
};

export const PLAN_ORDER: PlanTier[] = ["starter", "pro", "business"];

/** The plan whose limits apply right now (an expired trial falls back to Starter). */
export function effectivePlan(subscription: SubscriptionRow | null, now: Date = new Date()): PlanTier {
  if (!subscription) return "starter";
  if (subscription.status === "trialing") {
    return subscription.trial_end && new Date(subscription.trial_end) > now ? subscription.plan : "starter";
  }
  if (subscription.status === "active" || subscription.status === "past_due") return subscription.plan;
  return "starter";
}

export function formatLimit(value: number) {
  return Number.isFinite(value) ? String(value) : "Unlimited";
}
