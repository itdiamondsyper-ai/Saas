import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormSkeleton } from "@/components/auth/form-skeleton";
import { SignUpForm } from "@/components/auth/signup-form";
import { PLANS } from "@/lib/plans";

export const metadata: Metadata = { title: "Create your account" };

export default function SignUpPage({ searchParams }: PageProps<"/signup">) {
  return (
    <AuthCard
      title="Create your workspace"
      description="Free forever for solo work, with a 14-day Pro trial included."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton fields={4} />}>
        <SignUpContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignUpContent({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const params = await searchParams;
  const plan = params.plan === "pro" || params.plan === "business" ? PLANS[params.plan] : null;
  const invite = typeof params.invite === "string" ? params.invite : undefined;
  const email = typeof params.email === "string" ? params.email : undefined;
  return (
    <div className="grid gap-4">
      {plan && (
        <p className="rounded-lg bg-primary/8 px-3 py-2 text-sm text-primary">
          You&apos;re starting with the {plan.name} plan. Choose it in billing settings any time during your trial.
        </p>
      )}
      <SignUpForm inviteToken={invite} inviteEmail={invite ? email : undefined} />
    </div>
  );
}
