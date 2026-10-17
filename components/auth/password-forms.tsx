"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { FormError, FormField, fieldA11y } from "@/components/shared/form-field";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { forgotPasswordAction, resendVerificationAction, resetPasswordAction } from "@/lib/actions/auth";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validation/schemas";
import { cn } from "@/lib/utils";

export function ForgotPasswordForm() {
  const { run, pending, error } = useAction();
  const [sent, setSent] = useState<{ email: string; demoResetUrl?: string } | null>(null);
  const form = useForm<z.input<typeof forgotPasswordSchema>>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run(() => forgotPasswordAction(values));
    if (result.ok) setSent({ email: values.email, demoResetUrl: result.data.demoResetUrl });
    else applyFieldErrors(form, result.fieldErrors);
  });

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <MailCheck className="mx-auto size-8 text-primary" aria-hidden />
        <p className="text-sm">
          If an account exists for <strong>{sent.email}</strong>, we&apos;ve sent a link to reset your password. It expires in one
          hour.
        </p>
        {sent.demoResetUrl && (
          <div className="rounded-lg border border-dashed bg-muted/50 p-3 text-left text-xs">
            <p className="font-medium">Demo mode</p>
            <p className="mt-1 text-muted-foreground">Email isn&apos;t configured, so here is the reset link that would have been emailed:</p>
            <Link href={sent.demoResetUrl.replace(/^https?:\/\/[^/]+/, "")} className="mt-2 inline-block font-medium text-primary underline">
              Open reset link
            </Link>
          </div>
        )}
        <Link href="/login" className={cn(buttonVariants({ variant: "outline" }), "w-full")}>
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
      <FormField id="email" label="Email" error={form.formState.errors.email?.message}>
        <Input {...fieldA11y("email", form.formState.errors.email?.message)} type="email" autoComplete="email" className="h-9" {...form.register("email")} />
      </FormField>
      <Button type="submit" size="lg" className="h-9" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const [done, setDone] = useState(false);
  const form = useForm<z.input<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "", token },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run(() => resetPasswordAction({ ...values, token }));
    if (result.ok) setDone(true);
    else applyFieldErrors(form, result.fieldErrors);
  });

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto size-8 text-success" aria-hidden />
        <p className="text-sm">Your password was updated. Use it the next time you log in.</p>
        <Button className="w-full" onClick={() => router.push(token ? "/login" : "/dashboard")}>
          {token ? "Go to login" : "Continue to dashboard"}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
      <FormField id="password" label="New password" error={errors.password?.message} hint="At least 8 characters.">
        <Input {...fieldA11y("password", errors.password?.message)} type="password" autoComplete="new-password" className="h-9" {...form.register("password")} />
      </FormField>
      <FormField id="confirmPassword" label="Confirm new password" error={errors.confirmPassword?.message}>
        <Input
          {...fieldA11y("confirmPassword", errors.confirmPassword?.message)}
          type="password"
          autoComplete="new-password"
          className="h-9"
          {...form.register("confirmPassword")}
        />
      </FormField>
      <Button type="submit" size="lg" className="h-9" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Update password
      </Button>
    </form>
  );
}

export function ResendVerificationButton({ email }: { email: string }) {
  const { run, pending } = useAction();
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={pending || !email}
      onClick={() => run(() => resendVerificationAction({ email }), { success: "Verification email sent." })}
    >
      {pending && <Loader2 className="animate-spin" />}
      Resend verification email
    </Button>
  );
}
