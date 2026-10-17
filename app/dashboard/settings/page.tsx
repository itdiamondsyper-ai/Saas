import type { Metadata } from "next";
import Link from "next/link";
import {
  AppearanceSettings,
  BillingSettings,
  NotificationSettings,
  ProfileSettings,
  SecuritySettings,
  WorkspaceSettings,
} from "@/components/settings/settings-sections";
import { PageHeader } from "@/components/shared/page-header";
import { getBackend } from "@/lib/backend";
import { can } from "@/lib/permissions";
import { requireWorkspace } from "@/lib/server/context";
import { getBillingOverview } from "@/lib/services/billing";
import { soleOwnedWorkspaces } from "@/lib/services/workspace";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Settings" };

const TABS = [
  { value: "profile", label: "Profile" },
  { value: "workspace", label: "Workspace" },
  { value: "billing", label: "Billing" },
  { value: "notifications", label: "Notifications" },
  { value: "security", label: "Security" },
  { value: "appearance", label: "Appearance" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default async function SettingsPage({ searchParams }: PageProps<"/dashboard/settings">) {
  const ctx = await requireWorkspace();
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.value === sp.tab) ? (sp.tab as Tab) : "profile";

  let content: React.ReactNode;
  switch (tab) {
    case "workspace":
      content = (
        <WorkspaceSettings
          workspace={{ name: ctx.workspace.name, industry: ctx.workspace.industry ?? "", teamSize: ctx.workspace.team_size ?? "", logoUrl: ctx.workspace.logo_url }}
          canEdit={can(ctx.role, "workspace:update")}
          isOwner={ctx.role === "owner"}
          canLeave={ctx.memberships.length > 1 || ctx.role !== "owner"}
        />
      );
      break;
    case "billing": {
      const billing = await getBillingOverview(ctx);
      const sub = billing.subscription;
      content = (
        <BillingSettings
          plan={billing.plan}
          // An expired trial has already fallen back to Starter.
          status={sub?.status === "trialing" && billing.plan === "starter" ? "active" : (sub?.status ?? null)}
          trialEnd={sub?.trial_end ?? null}
          periodEnd={sub?.current_period_end ?? null}
          cancelAtPeriodEnd={sub?.cancel_at_period_end ?? false}
          card={sub?.payment_method_brand && sub.payment_method_last4 ? { brand: sub.payment_method_brand, last4: sub.payment_method_last4 } : null}
          history={billing.history.map((h) => ({ id: h.id, description: h.description, amount: Number(h.amount), currency: h.currency, status: h.status, created_at: h.created_at, invoice_url: h.invoice_url }))}
          mode={billing.mode}
          canManage={can(ctx.role, "billing:manage")}
          seatsUsed={billing.seatsUsed}
          checkoutResult={typeof sp.checkout === "string" ? sp.checkout : null}
        />
      );
      break;
    }
    case "notifications":
      content = <NotificationSettings prefs={ctx.profile.notification_prefs} />;
      break;
    case "security": {
      const [sessions, soleOwned] = await Promise.all([getBackend().auth.listSessions(), soleOwnedWorkspaces(ctx)]);
      content = <SecuritySettings sessions={sessions} soleOwned={soleOwned} />;
      break;
    }
    case "appearance":
      content = <AppearanceSettings />;
      break;
    default:
      content = (
        <ProfileSettings
          profile={{ fullName: ctx.profile.full_name, jobTitle: ctx.profile.job_title ?? "", email: ctx.profile.email, avatarUrl: ctx.profile.avatar_url }}
        />
      );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your profile, workspace, billing and preferences." />
      <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
        <nav aria-label="Settings sections" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <ul className="flex gap-1 lg:flex-col">
            {TABS.map((t) => (
              <li key={t.value}>
                <Link
                  href={`/dashboard/settings?tab=${t.value}`}
                  aria-current={tab === t.value ? "page" : undefined}
                  className={cn(
                    "block rounded-md px-3 py-1.5 text-sm whitespace-nowrap text-muted-foreground hover:bg-muted hover:text-foreground",
                    tab === t.value && "bg-muted font-medium text-foreground",
                  )}
                >
                  {t.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 max-w-3xl">{content}</div>
      </div>
    </div>
  );
}
