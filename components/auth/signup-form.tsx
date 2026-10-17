"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { FormError, FormField, fieldA11y } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { signUpAction } from "@/lib/actions/auth";
import { signUpSchema } from "@/lib/validation/schemas";

const inviteSchema = signUpSchema.omit({ workspaceName: true });

type Values = z.input<typeof signUpSchema>;

export function SignUpForm({ inviteToken, inviteEmail }: { inviteToken?: string; inviteEmail?: string }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const form = useForm<Values>({
    resolver: zodResolver((inviteToken ? inviteSchema : signUpSchema) as typeof signUpSchema),
    defaultValues: { fullName: "", email: inviteEmail ?? "", password: "", workspaceName: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run(() => signUpAction(inviteToken ? { ...values, inviteToken } : values), { error: undefined });
    if (result.ok) {
      router.replace(result.data.redirectTo);
      router.refresh();
    } else applyFieldErrors(form, result.fieldErrors);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
      <FormField id="fullName" label="Full name" error={errors.fullName?.message}>
        <Input {...fieldA11y("fullName", errors.fullName?.message)} autoComplete="name" className="h-9" {...form.register("fullName")} />
      </FormField>
      <FormField id="email" label="Work email" error={errors.email?.message}>
        <Input
          {...fieldA11y("email", errors.email?.message)}
          type="email"
          autoComplete="email"
          className="h-9"
          readOnly={!!inviteEmail}
          {...form.register("email")}
        />
      </FormField>
      <FormField id="password" label="Password" error={errors.password?.message} hint="At least 8 characters.">
        <Input
          {...fieldA11y("password", errors.password?.message)}
          type="password"
          autoComplete="new-password"
          className="h-9"
          {...form.register("password")}
        />
      </FormField>
      {!inviteToken && (
        <FormField id="workspaceName" label="Company or workspace name" error={errors.workspaceName?.message}>
          <Input
            {...fieldA11y("workspaceName", errors.workspaceName?.message)}
            autoComplete="organization"
            placeholder="e.g. Vertex Creative"
            className="h-9"
            {...form.register("workspaceName")}
          />
        </FormField>
      )}
      <Button type="submit" size="lg" className="h-9" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        {inviteToken ? "Create account and join" : "Create account"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        By continuing you agree to our{" "}
        <a href="/terms" className="underline underline-offset-2">Terms</a> and{" "}
        <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>.
      </p>
    </form>
  );
}

