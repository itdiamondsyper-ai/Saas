import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MailCheck } from "lucide-react";
import { AuthCard } from "@/components/auth/auth-card";
import { ResendVerificationButton } from "@/components/auth/password-forms";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Confirm your email" };

export default function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  return (
    <AuthCard
      title="Check your inbox"
      footer={
        <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
          Back to login
        </Link>
      }
    >
      <Suspense fallback={<Skeleton className="h-28 w-full" />}>
        <VerifyContent searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function VerifyContent({ searchParams }: Pick<PageProps<"/verify-email">, "searchParams">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  return (
    <div className="space-y-4 text-center">
      <MailCheck className="mx-auto size-9 text-primary" aria-hidden />
      <p className="text-sm">
        We sent a confirmation link to {email ? <strong>{email}</strong> : "your email address"}. Click it to activate your account and
        finish setting up your workspace.
      </p>
      <p className="text-xs text-muted-foreground">Didn&apos;t get it? Check your spam folder or resend it below.</p>
      <ResendVerificationButton email={email} />
    </div>
  );
}
