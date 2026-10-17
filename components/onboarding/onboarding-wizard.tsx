"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Check, FolderKanban, Loader2, Plus, Trash2, Users } from "lucide-react";
import { FormError, FormField, fieldA11y } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import {
  finishOnboardingAction,
  saveBusinessInfoAction,
  saveGoalAction,
  sendOnboardingInvitesAction,
} from "@/lib/actions/workspace";
import { INDUSTRIES, PRIMARY_GOALS, TEAM_SIZES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { email, requiredText } from "@/lib/validation/common";
import { businessInfoSchema, inviteRole } from "@/lib/validation/schemas";

const STEPS = ["Business", "Goal", "Team", "First record"] as const;

interface Initial {
  name: string;
  industry: string;
  teamSize: string;
  goal: string;
}

export function OnboardingWizard({ firstName, initial }: { firstName: string; initial: Initial }) {
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState(initial.goal);

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">Welcome, {firstName}</p>
        <h1 className="text-2xl font-semibold tracking-tight">Let&apos;s set up your workspace</h1>
      </div>
      <ol aria-label="Onboarding progress" className="grid grid-cols-4 gap-2">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className="space-y-1.5">
            <div className={cn("h-1.5 rounded-full transition-colors", i <= step ? "bg-primary" : "bg-border")} />
            <p className={cn("text-xs", i === step ? "font-medium text-foreground" : "text-muted-foreground")}>
              <span className="sr-only">Step {i + 1} of 4: </span>
              {label}
            </p>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border bg-card p-5 shadow-xs sm:p-6">
        {step === 0 && <BusinessStep initial={initial} onDone={() => setStep(1)} />}
        {step === 1 && (
          <GoalStep
            value={goal}
            onBack={() => setStep(0)}
            onDone={(g) => {
              setGoal(g);
              setStep(2);
            }}
          />
        )}
        {step === 2 && <TeamStep onBack={() => setStep(1)} onDone={() => setStep(3)} />}
        {step === 3 && <FirstRecordStep goal={goal} onBack={() => setStep(2)} />}
      </div>
    </div>
  );
}

function StepHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-5 space-y-1">
      <h2 className="font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function BusinessStep({ initial, onDone }: { initial: Initial; onDone: () => void }) {
  const { run, pending, error } = useAction();
  const form = useForm<z.input<typeof businessInfoSchema>>({
    resolver: zodResolver(businessInfoSchema),
    defaultValues: { name: initial.name, industry: initial.industry, teamSize: initial.teamSize },
  });
  const { errors } = form.formState;
  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const result = await run(() => saveBusinessInfoAction(values));
        if (result.ok) onDone();
        else applyFieldErrors(form, result.fieldErrors);
      })}
      className="grid gap-4"
    >
      <StepHeader title="Tell us about your business" description="This helps us tailor FlowPilot to how you work." />
      <FormError message={error} />
      <FormField id="ob-name" label="Company name" error={errors.name?.message} required>
        <Input {...fieldA11y("ob-name", errors.name?.message)} className="h-9" {...form.register("name")} />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="ob-industry" label="Industry" error={errors.industry?.message} required>
          <NativeSelect {...fieldA11y("ob-industry", errors.industry?.message)} {...form.register("industry")}>
            <option value="">Select an industry</option>
            {INDUSTRIES.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="ob-size" label="Team size" error={errors.teamSize?.message} required>
          <NativeSelect {...fieldA11y("ob-size", errors.teamSize?.message)} {...form.register("teamSize")}>
            <option value="">Select a size</option>
            {TEAM_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </NativeSelect>
        </FormField>
      </div>
      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          Continue
        </Button>
      </div>
    </form>
  );
}

function GoalStep({ value, onBack, onDone }: { value: string; onBack: () => void; onDone: (goal: string) => void }) {
  const [goal, setGoal] = useState(value || PRIMARY_GOALS[0].value);
  const { run, pending } = useAction();
  return (
    <div>
      <StepHeader title="What's your main goal?" description="We'll highlight the parts of FlowPilot that matter most to you." />
      <div role="radiogroup" aria-label="Main goal" className="grid gap-2">
        {PRIMARY_GOALS.map((g) => (
          <button
            key={g.value}
            type="button"
            role="radio"
            aria-checked={goal === g.value}
            onClick={() => setGoal(g.value)}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50",
              goal === g.value && "border-primary bg-primary/5 ring-1 ring-primary/30",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                goal === g.value && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {goal === g.value && <Check className="size-3" />}
            </span>
            <span>
              <span className="block text-sm font-medium">{g.value}</span>
              <span className="block text-xs text-muted-foreground">{g.description}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex justify-between pt-5">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          disabled={pending}
          onClick={async () => {
            const result = await run(() => saveGoalAction({ goal }));
            if (result.ok) onDone(goal);
          }}
        >
          {pending && <Loader2 className="animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  );
}

const invitesFormSchema = z.object({
  invites: z.array(z.object({ email: z.union([z.literal(""), email]), role: inviteRole })),
});

function TeamStep({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { run, pending, error } = useAction();
  const [sent, setSent] = useState<{ email: string; link: string }[] | null>(null);
  const form = useForm<z.input<typeof invitesFormSchema>>({
    resolver: zodResolver(invitesFormSchema),
    defaultValues: { invites: [{ email: "", role: "member" }] },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "invites" });

  if (sent) {
    return (
      <div className="space-y-4">
        <StepHeader title="Invitations created" description="Share these links with your teammates. They're valid for 14 days." />
        <ul className="space-y-2">
          {sent.map((s) => (
            <li key={s.email} className="rounded-lg border p-3 text-sm">
              <p className="font-medium">{s.email}</p>
              <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{s.link}</p>
            </li>
          ))}
        </ul>
        <div className="flex justify-end">
          <Button onClick={onDone}>Continue</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={form.handleSubmit(async (values) => {
        const invites = values.invites.filter((i) => i.email);
        if (!invites.length) return onDone();
        const result = await run(() => sendOnboardingInvitesAction({ invites }), { success: "Invitations sent" });
        if (result.ok) setSent(result.data);
        else applyFieldErrors(form, result.fieldErrors);
      })}
      className="grid gap-4"
    >
      <StepHeader title="Invite your team" description="Bring in the people you work with. You can always do this later." />
      <FormError message={error} />
      <div className="grid gap-3">
        {fields.map((field, index) => {
          const err = form.formState.errors.invites?.[index]?.email?.message;
          return (
            <div key={field.id} className="grid grid-cols-[1fr_auto_auto] items-start gap-2">
              <div>
                <label htmlFor={`invite-${index}`} className="sr-only">
                  Teammate email {index + 1}
                </label>
                <Input
                  {...fieldA11y(`invite-${index}`, err)}
                  type="email"
                  placeholder="teammate@company.com"
                  className="h-9"
                  {...form.register(`invites.${index}.email`)}
                />
                {err && <p className="mt-1 text-xs text-destructive">{err}</p>}
              </div>
              <NativeSelect aria-label="Role" className="w-28" {...form.register(`invites.${index}.role`)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="viewer">Viewer</option>
              </NativeSelect>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-9"
                aria-label="Remove row"
                disabled={fields.length === 1}
                onClick={() => remove(index)}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </div>
      {fields.length < 10 && (
        <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => append({ email: "", role: "member" })}>
          <Plus /> Add another
        </Button>
      )}
      <div className="flex justify-between pt-2">
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onDone}>
            Skip
          </Button>
          <Button type="submit" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            Send invites
          </Button>
        </div>
      </div>
    </form>
  );
}

const firstClientSchema = z.object({
  company: requiredText("Company", 120),
  contactName: requiredText("Contact name", 80),
  email: z.union([z.literal(""), email]),
});
const firstProjectSchema = z.object({
  name: requiredText("Project name", 120),
  dueDate: z.string(),
});

function FirstRecordStep({ goal, onBack }: { goal: string; onBack: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<"client" | "project">(goal === "Manage projects" || goal === "Manage team" ? "project" : "client");
  const { run, pending, error } = useAction();
  const clientForm = useForm<z.input<typeof firstClientSchema>>({
    resolver: zodResolver(firstClientSchema),
    defaultValues: { company: "", contactName: "", email: "" },
  });
  const projectForm = useForm<z.input<typeof firstProjectSchema>>({
    resolver: zodResolver(firstProjectSchema),
    defaultValues: { name: "", dueDate: "" },
  });

  const finish = async (payload: unknown) => {
    const result = await run(() => finishOnboardingAction(payload), { success: "You're all set!" });
    if (result.ok) {
      router.replace(result.data.redirectTo);
      router.refresh();
    }
  };

  return (
    <div className="grid gap-4">
      <StepHeader title="Add your first client or project" description="Start with whatever you're working on right now." />
      <div role="tablist" aria-label="Record type" className="grid grid-cols-2 gap-2">
        {(
          [
            ["client", "A client", Users],
            ["project", "A project", FolderKanban],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={kind === value}
            onClick={() => setKind(value)}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium",
              kind === value ? "border-primary bg-primary/5 text-primary" : "text-muted-foreground hover:bg-muted/50",
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <FormError message={error} />
      {kind === "client" ? (
        <form
          noValidate
          className="grid gap-4"
          onSubmit={clientForm.handleSubmit((v) =>
            finish({
              kind: "client",
              client: { company: v.company, contactName: v.contactName, email: v.email, phone: "", website: "", industry: "", address: "", status: "active", tags: [], notes: "" },
            }),
          )}
        >
          <FormField id="fc-company" label="Company" error={clientForm.formState.errors.company?.message} required>
            <Input {...fieldA11y("fc-company", clientForm.formState.errors.company?.message)} className="h-9" {...clientForm.register("company")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="fc-contact" label="Contact name" error={clientForm.formState.errors.contactName?.message} required>
              <Input {...fieldA11y("fc-contact", clientForm.formState.errors.contactName?.message)} className="h-9" {...clientForm.register("contactName")} />
            </FormField>
            <FormField id="fc-email" label="Contact email" error={clientForm.formState.errors.email?.message}>
              <Input {...fieldA11y("fc-email", clientForm.formState.errors.email?.message)} type="email" className="h-9" {...clientForm.register("email")} />
            </FormField>
          </div>
          <StepFooter pending={pending} onBack={onBack} onSkip={() => finish({ kind: "skip" })} label="Add client and finish" />
        </form>
      ) : (
        <form
          noValidate
          className="grid gap-4"
          onSubmit={projectForm.handleSubmit((v) =>
            finish({
              kind: "project",
              project: { name: v.name, clientId: "", ownerId: "", status: "active", priority: "medium", startDate: "", dueDate: v.dueDate, budget: 0, progress: 0, description: "", memberIds: [] },
            }),
          )}
        >
          <FormField id="fp-name" label="Project name" error={projectForm.formState.errors.name?.message} required>
            <Input {...fieldA11y("fp-name", projectForm.formState.errors.name?.message)} className="h-9" {...projectForm.register("name")} />
          </FormField>
          <FormField id="fp-due" label="Due date">
            <Input id="fp-due" type="date" className="h-9" {...projectForm.register("dueDate")} />
          </FormField>
          <StepFooter pending={pending} onBack={onBack} onSkip={() => finish({ kind: "skip" })} label="Create project and finish" />
        </form>
      )}
    </div>
  );
}

function StepFooter({ pending, onBack, onSkip, label }: { pending: boolean; onBack: () => void; onSkip: () => void; label: string }) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-between">
      <Button type="button" variant="ghost" onClick={onBack}>
        Back
      </Button>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="outline" disabled={pending} onClick={onSkip}>
          I&apos;ll do this later
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {label}
        </Button>
      </div>
    </div>
  );
}
