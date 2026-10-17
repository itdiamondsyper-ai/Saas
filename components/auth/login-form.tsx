"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { FormError, FormField, fieldA11y } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { loginAction } from "@/lib/actions/auth";
import { loginSchema } from "@/lib/validation/schemas";

type Values = z.input<typeof loginSchema>;

export function LoginForm({ next, defaultEmail }: { next?: string; defaultEmail?: string }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const form = useForm<Values>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: defaultEmail ?? "", password: "" },
  });
  const { errors } = form.formState;

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run(() => loginAction({ ...values, next }), { error: undefined });
    if (result.ok) {
      router.replace(result.data.redirectTo);
      router.refresh();
    } else applyFieldErrors(form, result.fieldErrors);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormError message={error} />
      <FormField id="email" label="Email" error={errors.email?.message}>
        <Input {...fieldA11y("email", errors.email?.message)} type="email" autoComplete="email" className="h-9" {...form.register("email")} />
      </FormField>
      <FormField id="password" label="Password" error={errors.password?.message}>
        <Input
          {...fieldA11y("password", errors.password?.message)}
          type="password"
          autoComplete="current-password"
          className="h-9"
          {...form.register("password")}
        />
      </FormField>
      <div className="-mt-1 text-right">
        <Link href="/forgot-password" className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" size="lg" className="h-9" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Log in
      </Button>
    </form>
  );
}
