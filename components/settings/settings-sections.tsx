"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Check, CreditCard, Laptop, Loader2, Moon, Sun, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { FormError, FormField, fieldA11y } from "@/components/shared/form-field";
import { StatusBadge } from "@/components/shared/status-badge";
import { UserAvatar } from "@/components/shared/user-avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import {
  changeEmailAction,
  changePasswordAction,
  changePlanAction,
  deleteAccountAction,
  deleteWorkspaceAction,
  leaveWorkspaceAction,
  removeAvatarAction,
  removeLogoAction,
  revokeOtherSessionsAction,
  updateNotificationPrefsAction,
  updateProfileAction,
  updateWorkspaceAction,
  uploadAvatarAction,
  uploadLogoAction,
} from "@/lib/actions/account";
import { INDUSTRIES, TEAM_SIZES } from "@/lib/constants";
import { formatCurrency, formatDate, formatRelative } from "@/lib/format";
import { PLAN_ORDER, PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { changePasswordSchema, profileSchema, workspaceSettingsSchema } from "@/lib/validation/schemas";
import type { NotificationPrefs, PlanTier, SubscriptionStatus } from "@/types/database";

function Section({ title, description, children, footer }: { title: string; description?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="space-y-1 border-b px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <div className="p-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t bg-muted/30 px-5 py-3">{footer}</div>}
    </section>
  );
}

function ImageUpload({
  label,
  preview,
  onUpload,
  onRemove,
  disabled,
}: {
  label: string;
  preview: React.ReactNode;
  onUpload: (file: File) => Promise<boolean>;
  onRemove?: () => Promise<void>;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-4">
      {preview}
      <div className="space-y-1.5">
        <div className="flex gap-2">
          <input
            ref={ref}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="sr-only"
            aria-label={label}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) return void toast.error("Images must be 2 MB or smaller.");
              setBusy(true);
              await onUpload(file);
              setBusy(false);
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={busy || disabled} onClick={() => ref.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />} Upload
          </Button>
          {onRemove && (
            <Button type="button" variant="ghost" size="sm" disabled={busy || disabled} onClick={() => void onRemove()}>
              Remove
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG, WebP or GIF up to 2 MB.</p>
      </div>
    </div>
  );
}

// --- Profile -----------------------------------------------------------------

export function ProfileSettings({ profile }: { profile: { fullName: string; jobTitle: string; email: string; avatarUrl: string | null } }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const email = useAction();
  const [newEmail, setNewEmail] = useState(profile.email);
  const form = useForm<z.input<typeof profileSchema>, unknown, z.output<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: { fullName: profile.fullName, jobTitle: profile.jobTitle },
  });
  const { errors } = form.formState;

  const upload = async (file: File) => {
    const data = new FormData();
    data.set("file", file);
    const r = await uploadAvatarAction(data);
    if (r.ok) {
      toast.success("Avatar updated");
      router.refresh();
    } else toast.error(r.error);
    return r.ok;
  };

  return (
    <div className="space-y-6">
      <form
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          const r = await run(() => updateProfileAction(values), { success: "Profile saved" });
          if (r.ok) router.refresh();
          else applyFieldErrors(form, r.fieldErrors);
        })}
      >
        <Section
          title="Profile"
          description="How you appear to your teammates."
          footer={
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Save profile
            </Button>
          }
        >
          <div className="grid gap-5">
            <ImageUpload
              label="Upload avatar"
              preview={<UserAvatar name={profile.fullName} src={profile.avatarUrl} size="lg" className="size-14" />}
              onUpload={upload}
              onRemove={
                profile.avatarUrl
                  ? async () => {
                      const r = await run(() => removeAvatarAction(), { success: "Avatar removed" });
                      if (r.ok) router.refresh();
                    }
                  : undefined
              }
            />
            <FormError message={error && !Object.keys(errors).length ? error : null} />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="profile-name" label="Full name" error={errors.fullName?.message} required>
                <Input {...fieldA11y("profile-name", errors.fullName?.message)} autoComplete="name" className="h-9" {...form.register("fullName")} />
              </FormField>
              <FormField id="profile-title" label="Job title" error={errors.jobTitle?.message}>
                <Input {...fieldA11y("profile-title", errors.jobTitle?.message)} autoComplete="organization-title" className="h-9" {...form.register("jobTitle")} />
              </FormField>
            </div>
          </div>
        </Section>
      </form>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await email.run(() => changeEmailAction({ email: newEmail }));
          if (r.ok) {
            toast.success(r.data.pendingConfirmation ? "Check your new inbox to confirm the change." : "Email updated");
            router.refresh();
          }
        }}
      >
        <Section
          title="Email address"
          description="Used to sign in and receive notifications."
          footer={
            <Button type="submit" variant="outline" disabled={email.pending || newEmail.trim().toLowerCase() === profile.email.toLowerCase()}>
              {email.pending && <Loader2 className="animate-spin" />} Update email
            </Button>
          }
        >
          <FormField id="profile-email" label="Email" error={email.error ?? undefined}>
            <Input id="profile-email" type="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-9 sm:max-w-sm" />
          </FormField>
        </Section>
      </form>
    </div>
  );
}

// --- Workspace ---------------------------------------------------------------

export function WorkspaceSettings({
  workspace,
  canEdit,
  isOwner,
  canLeave,
}: {
  workspace: { name: string; industry: string; teamSize: string; logoUrl: string | null };
  canEdit: boolean;
  isOwner: boolean;
  canLeave: boolean;
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const danger = useAction();
  const [confirm, setConfirm] = useState<"delete" | "leave" | null>(null);
  const [confirmName, setConfirmName] = useState("");
  const form = useForm<z.input<typeof workspaceSettingsSchema>, unknown, z.output<typeof workspaceSettingsSchema>>({
    resolver: zodResolver(workspaceSettingsSchema),
    defaultValues: { name: workspace.name, industry: workspace.industry, teamSize: workspace.teamSize },
  });
  const { errors } = form.formState;

  return (
    <div className="space-y-6">
      <form
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          const r = await run(() => updateWorkspaceAction(values), { success: "Workspace settings saved" });
          if (r.ok) router.refresh();
          else applyFieldErrors(form, r.fieldErrors);
        })}
      >
        <Section
          title="Workspace"
          description={canEdit ? "Your company details, shown on invoices and to your team." : "Only owners and admins can change workspace settings."}
          footer={
            canEdit && (
              <Button type="submit" disabled={pending}>
                {pending && <Loader2 className="animate-spin" />} Save workspace
              </Button>
            )
          }
        >
          <div className="grid gap-5">
            <ImageUpload
              label="Upload workspace logo"
              disabled={!canEdit}
              preview={
                workspace.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user-uploaded logo
                  <img src={workspace.logoUrl} alt="Workspace logo" className="size-14 rounded-xl object-cover" />
                ) : (
                  <span className="flex size-14 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground">
                    {workspace.name.slice(0, 1).toUpperCase()}
                  </span>
                )
              }
              onUpload={async (file) => {
                const data = new FormData();
                data.set("file", file);
                const r = await uploadLogoAction(data);
                if (r.ok) {
                  toast.success("Logo updated");
                  router.refresh();
                } else toast.error(r.error);
                return r.ok;
              }}
              onRemove={
                workspace.logoUrl && canEdit
                  ? async () => {
                      const r = await run(() => removeLogoAction(), { success: "Logo removed" });
                      if (r.ok) router.refresh();
                    }
                  : undefined
              }
            />
            <FormError message={error && !Object.keys(errors).length ? error : null} />
            <fieldset disabled={!canEdit} className="grid gap-4 sm:grid-cols-3">
              <FormField id="ws-name" label="Workspace name" error={errors.name?.message} required>
                <Input {...fieldA11y("ws-name", errors.name?.message)} className="h-9" {...form.register("name")} />
              </FormField>
              <FormField id="ws-industry" label="Industry">
                <NativeSelect id="ws-industry" {...form.register("industry")}>
                  <option value="">Not set</option>
                  {[...new Set([workspace.industry, ...INDUSTRIES].filter(Boolean))].map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
              <FormField id="ws-size" label="Team size">
                <NativeSelect id="ws-size" {...form.register("teamSize")}>
                  <option value="">Not set</option>
                  {TEAM_SIZES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </NativeSelect>
              </FormField>
            </fieldset>
          </div>
        </Section>
      </form>

      <Section title="Danger zone" description="These actions can't be undone.">
        <div className="space-y-4">
          {canLeave && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Leave workspace</p>
                <p className="text-sm text-muted-foreground">You&apos;ll lose access until someone invites you again.</p>
              </div>
              <Button variant="outline" onClick={() => setConfirm("leave")}>
                Leave workspace
              </Button>
            </div>
          )}
          {isOwner && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium">Delete workspace</p>
                <p className="text-sm text-muted-foreground">Permanently delete {workspace.name} and all of its data.</p>
              </div>
              <Button variant="destructive" onClick={() => setConfirm("delete")}>
                Delete workspace
              </Button>
            </div>
          )}
        </div>
      </Section>

      <ConfirmDialog
        open={confirm === "leave"}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Leave ${workspace.name}?`}
        description="You'll lose access to its clients, projects and invoices."
        confirmLabel="Leave workspace"
        destructive
        onConfirm={async () => {
          const r = await danger.run(() => leaveWorkspaceAction(), { success: `You left ${workspace.name}` });
          if (r.ok) {
            router.push("/dashboard");
            router.refresh();
          }
          return r.ok;
        }}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(o) => {
          if (!o) {
            setConfirm(null);
            setConfirmName("");
          }
        }}
        title={`Delete ${workspace.name}?`}
        description="All clients, projects, tasks, invoices, files and activity in this workspace will be permanently deleted."
        confirmLabel="Delete forever"
        destructive
        onConfirm={async () => {
          const r = await danger.run(() => deleteWorkspaceAction({ confirmation: confirmName }), { success: "Workspace deleted" });
          if (r.ok) {
            router.push("/dashboard");
            router.refresh();
          }
          return r.ok;
        }}
      >
        <FormField id="confirm-ws" label={`Type “${workspace.name}” to confirm`}>
          <Input id="confirm-ws" value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className="h-9" autoComplete="off" />
        </FormField>
      </ConfirmDialog>
    </div>
  );
}

// --- Billing -----------------------------------------------------------------

export function BillingSettings({
  plan,
  status,
  trialEnd,
  periodEnd,
  cancelAtPeriodEnd,
  card,
  history,
  mode,
  canManage,
  seatsUsed,
  checkoutResult,
}: {
  plan: PlanTier;
  status: SubscriptionStatus | null;
  trialEnd: string | null;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  card: { brand: string; last4: string } | null;
  history: { id: string; description: string; amount: number; currency: string; status: string; created_at: string; invoice_url: string | null }[];
  mode: "stripe" | "simulated" | "unavailable";
  canManage: boolean;
  seatsUsed: number;
  checkoutResult: string | null;
}) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [target, setTarget] = useState<PlanTier | null>(null);
  const trialing = status === "trialing";

  const change = async (next: PlanTier) => {
    const r = await run(() => changePlanAction({ plan: next }));
    if (!r.ok) return false;
    if (r.data.kind === "redirect") {
      window.location.href = r.data.url;
      return true;
    }
    toast.success(`You're now on the ${PLANS[next].name} plan`);
    router.refresh();
    return true;
  };

  return (
    <div className="space-y-6">
      {checkoutResult === "success" && (
        <p role="status" className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm text-success">
          Payment received. Your plan updates as soon as Stripe confirms the subscription.
        </p>
      )}
      {checkoutResult === "cancelled" && (
        <p role="status" className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">
          Checkout was cancelled. You haven&apos;t been charged.
        </p>
      )}
      <Section title="Current plan" description={mode === "simulated" ? "Demo mode: plan changes apply instantly without a real payment." : undefined}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p className="flex items-center gap-2 text-lg font-semibold">
              {PLANS[plan].name}
              {trialing && <StatusBadge tone="brand">Trial</StatusBadge>}
              {status === "past_due" && <StatusBadge tone="danger">Payment failed</StatusBadge>}
              {cancelAtPeriodEnd && <StatusBadge tone="warning">Cancels at period end</StatusBadge>}
            </p>
            <p className="text-sm text-muted-foreground">
              {PLANS[plan].price === 0 ? "Free forever" : `${formatCurrency(PLANS[plan].price)} per month`}
              {trialing && trialEnd ? ` · trial ends ${formatDate(trialEnd, "long")}` : ""}
              {!trialing && periodEnd && PLANS[plan].price > 0 ? ` · renews ${formatDate(periodEnd, "long")}` : ""}
            </p>
            <p className="text-xs text-muted-foreground">
              {seatsUsed} of {Number.isFinite(PLANS[plan].limits.users) ? PLANS[plan].limits.users : "unlimited"} users
            </p>
          </div>
          {mode === "stripe" && canManage && !trialing && plan !== "starter" && (
            <Button variant="outline" disabled={pending} onClick={() => void change(plan === "pro" ? "business" : "pro")}>
              Manage subscription
            </Button>
          )}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-3">
        {PLAN_ORDER.map((id) => {
          const p = PLANS[id];
          const current = id === plan && !trialing;
          return (
            <div key={id} className={cn("flex flex-col rounded-xl border bg-card p-5", current && "border-primary/50 ring-1 ring-primary/30")}>
              <div className="flex items-center justify-between">
                <p className="font-semibold">{p.name}</p>
                {current && <StatusBadge tone="brand">Current</StatusBadge>}
              </div>
              <p className="mt-2 text-2xl font-semibold tabular">
                {p.price === 0 ? "Free" : `$${p.price}`}
                {p.price > 0 && <span className="text-sm font-normal text-muted-foreground">/month</span>}
              </p>
              <ul className="mt-4 flex-1 space-y-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-5"
                variant={current ? "outline" : "default"}
                disabled={current || !canManage || mode === "unavailable" || pending}
                onClick={() => setTarget(id)}
              >
                {current ? "Current plan" : PLAN_ORDER.indexOf(id) > PLAN_ORDER.indexOf(plan) || trialing ? `Choose ${p.name}` : `Downgrade to ${p.name}`}
              </Button>
            </div>
          );
        })}
      </div>
      {!canManage && <p className="text-sm text-muted-foreground">Only workspace owners can change the plan.</p>}
      {mode === "unavailable" && <p className="text-sm text-muted-foreground">Billing isn&apos;t configured on this server yet. Add Stripe keys to enable upgrades.</p>}

      <Section title="Payment method">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-lg border bg-muted">
              <CreditCard className="size-5 text-muted-foreground" aria-hidden />
            </span>
            {card ? (
              <div>
                <p className="text-sm font-medium capitalize">
                  {card.brand} ending in {card.last4}
                </p>
                <p className="text-xs text-muted-foreground">Used for your FlowPilot subscription</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No payment method on file.</p>
            )}
          </div>
          {canManage && mode === "stripe" && (
            <Button variant="outline" disabled={pending} onClick={() => void change(plan === "pro" ? "business" : "pro")}>
              Update in Stripe
            </Button>
          )}
          {canManage && mode === "simulated" && (
            <p className="max-w-48 text-right text-xs text-muted-foreground">Card updates go through the Stripe billing portal once Stripe is connected.</p>
          )}
        </div>
      </Section>

      <Section title="Billing history">
        {history.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b">
                  <th scope="col" className="py-2 font-medium">Date</th>
                  <th scope="col" className="py-2 font-medium">Description</th>
                  <th scope="col" className="py-2 font-medium">Status</th>
                  <th scope="col" className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="py-2.5">{formatDate(h.created_at, "long")}</td>
                    <td className="py-2.5">
                      {h.invoice_url ? (
                        <a href={h.invoice_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          {h.description}
                        </a>
                      ) : (
                        h.description
                      )}
                    </td>
                    <td className="py-2.5 capitalize">{h.status}</td>
                    <td className="py-2.5 text-right tabular">{formatCurrency(h.amount, h.currency, { cents: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No payments yet.</p>
        )}
      </Section>

      <ConfirmDialog
        open={!!target}
        onOpenChange={(o) => !o && setTarget(null)}
        title={target ? `Switch to ${PLANS[target].name}?` : ""}
        description={
          target
            ? mode === "stripe"
              ? "You'll be redirected to Stripe to complete the change securely."
              : `Your workspace will move to ${PLANS[target].name}${PLANS[target].price ? ` at ${formatCurrency(PLANS[target].price)}/month` : ""}.`
            : ""
        }
        confirmLabel="Confirm change"
        onConfirm={async () => (target ? change(target) : undefined)}
      />
    </div>
  );
}

// --- Notifications -------------------------------------------------------------

const PREF_LABELS: { key: keyof NotificationPrefs; label: string; description: string }[] = [
  { key: "email", label: "Email notifications", description: "Receive important updates by email in addition to the in-app inbox." },
  { key: "invoices", label: "Invoice notifications", description: "When an invoice is paid or becomes overdue." },
  { key: "tasks", label: "Task notifications", description: "When you're assigned a task or someone comments on yours." },
  { key: "weekly_report", label: "Weekly report", description: "A Monday summary of revenue, deadlines and team activity." },
];

export function NotificationSettings({ prefs }: { prefs: NotificationPrefs }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const [values, setValues] = useState(prefs);
  const dirty = PREF_LABELS.some((p) => values[p.key] !== prefs[p.key]);
  return (
    <Section
      title="Notifications"
      description="Choose what FlowPilot tells you about."
      footer={
        <Button
          disabled={!dirty || pending}
          onClick={async () => {
            const r = await run(() => updateNotificationPrefsAction(values), { success: "Notification preferences saved" });
            if (r.ok) router.refresh();
          }}
        >
          {pending && <Loader2 className="animate-spin" />} Save preferences
        </Button>
      }
    >
      <ul className="divide-y">
        {PREF_LABELS.map((p) => (
          <li key={p.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <div>
              <label htmlFor={`pref-${p.key}`} className="text-sm font-medium">
                {p.label}
              </label>
              <p className="text-sm text-muted-foreground">{p.description}</p>
            </div>
            <Switch id={`pref-${p.key}`} checked={values[p.key]} onCheckedChange={(checked) => setValues((v) => ({ ...v, [p.key]: checked }))} />
          </li>
        ))}
      </ul>
    </Section>
  );
}

// --- Security -----------------------------------------------------------------

export function SecuritySettings({
  sessions,
  soleOwned,
}: {
  sessions: { id: string; current: boolean; userAgent: string; createdAt: string | null; lastSeenAt: string | null }[];
  soleOwned: string[];
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const sessionsAction = useAction();
  const deleteAction = useAction();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const form = useForm<z.input<typeof changePasswordSchema>>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });
  const { errors } = form.formState;

  const describeAgent = (ua: string) => {
    const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Browser";
    const os = /Windows/.test(ua) ? "Windows" : /Mac OS X/.test(ua) ? "macOS" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
    return `${browser} on ${os}`;
  };

  return (
    <div className="space-y-6">
      <form
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          const r = await run(() => changePasswordAction(values), { success: "Password changed. Other sessions were signed out." });
          if (r.ok) form.reset();
          else applyFieldErrors(form, r.fieldErrors);
        })}
      >
        <Section
          title="Change password"
          footer={
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Update password
            </Button>
          }
        >
          <div className="grid gap-4 sm:max-w-sm">
            <FormError message={error && !Object.keys(errors).length ? error : null} />
            <FormField id="current-password" label="Current password" error={errors.currentPassword?.message}>
              <Input {...fieldA11y("current-password", errors.currentPassword?.message)} type="password" autoComplete="current-password" className="h-9" {...form.register("currentPassword")} />
            </FormField>
            <FormField id="new-password" label="New password" error={errors.newPassword?.message} hint="At least 8 characters.">
              <Input {...fieldA11y("new-password", errors.newPassword?.message)} type="password" autoComplete="new-password" className="h-9" {...form.register("newPassword")} />
            </FormField>
            <FormField id="confirm-password" label="Confirm new password" error={errors.confirmPassword?.message}>
              <Input {...fieldA11y("confirm-password", errors.confirmPassword?.message)} type="password" autoComplete="new-password" className="h-9" {...form.register("confirmPassword")} />
            </FormField>
          </div>
        </Section>
      </form>

      <Section
        title="Active sessions"
        description="Devices currently signed in to your account."
        footer={
          <Button
            variant="outline"
            disabled={sessionsAction.pending}
            onClick={async () => {
              const r = await sessionsAction.run(() => revokeOtherSessionsAction(), { success: "Signed out of all other sessions" });
              if (r.ok) router.refresh();
            }}
          >
            {sessionsAction.pending && <Loader2 className="animate-spin" />} Sign out other sessions
          </Button>
        }
      >
        <ul className="divide-y">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <Laptop className="size-5 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {describeAgent(s.userAgent)} {s.current && <StatusBadge tone="success">This device</StatusBadge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  Signed in {s.createdAt ? formatRelative(s.createdAt) : "recently"} · last active {formatRelative(s.lastSeenAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Delete account" description="Permanently delete your FlowPilot account.">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {soleOwned.length
              ? `This also deletes workspaces you solely own: ${soleOwned.join(", ")}.`
              : "You'll be removed from all workspaces you belong to."}
          </p>
          <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
            Delete account
          </Button>
        </div>
      </Section>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(o) => {
          setDeleteOpen(o);
          if (!o) setConfirmText("");
        }}
        title="Delete your account?"
        description={soleOwned.length ? `Your account and ${soleOwned.join(", ")} will be permanently deleted.` : "Your account will be permanently deleted."}
        confirmLabel="Delete account"
        destructive
        onConfirm={async () => {
          const r = await deleteAction.run(() => deleteAccountAction({ confirmation: confirmText }));
          if (r.ok) {
            router.push("/");
            router.refresh();
          }
          return r.ok;
        }}
      >
        <FormField id="confirm-delete" label="Type DELETE to confirm" error={deleteAction.error ?? undefined}>
          <Input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="h-9" autoComplete="off" />
        </FormField>
      </ConfirmDialog>
    </div>
  );
}

// --- Appearance ----------------------------------------------------------------

const subscribeNoop = () => () => {};

export function AppearanceSettings() {
  const { theme: activeTheme, setTheme } = useTheme();
  // The saved theme is only known in the browser; avoid a hydration mismatch.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const theme = mounted ? activeTheme : undefined;
  const options = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
  ];
  return (
    <Section title="Appearance" description="Choose how FlowPilot looks on this device.">
      <div role="radiogroup" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={theme === o.value}
            onClick={() => setTheme(o.value)}
            className={cn("flex items-center gap-3 rounded-lg border p-4 text-left text-sm font-medium hover:bg-muted/50", theme === o.value && "border-primary ring-1 ring-primary/30")}
          >
            <o.icon className="size-4" aria-hidden /> {o.label}
            {theme === o.value && <Check className="ml-auto size-4 text-primary" aria-hidden />}
          </button>
        ))}
      </div>
    </Section>
  );
}
