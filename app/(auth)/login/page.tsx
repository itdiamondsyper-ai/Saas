import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { FormSkeleton } from "@/components/auth/form-skeleton";
import { LoginForm } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { startDemoAction } from "@/lib/actions/demo";
import { DEMO_OWNER_EMAIL, DEMO_PASSWORD } from "@/lib/demo/seed";
import { isDemoMode } from "@/lib/env";

export const metadata: Metadata = { title: "Log in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard
      title="Welcome back"
      description="Log in to your FlowPilot workspace."
      footer={
        <>
          New to FlowPilot?{" "}
          <Link href="/signup" className="font-medium text-foreground underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <LoginContent searchParams={searchParams} />
      </Suspense>
      {isDemoMode() && (
        <div className="mt-5 space-y-2 rounded-lg border border-dashed bg-muted/40 p-3 text-xs">
          <p className="font-medium">Demo workspace</p>
          <p className="text-muted-foreground">
            Sign in as <span className="font-mono">{DEMO_OWNER_EMAIL}</span> with password <span className="font-mono">{DEMO_PASSWORD}</span>, or
            jump straight in.
          </p>
          <form action={startDemoAction}>
            <Button type="submit" variant="secondary" size="sm" className="w-full">
              Open the demo workspace
            </Button>
          </form>
        </div>
      )}
    </AuthCard>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const notice =
    params.signedOut === "1"
      ? "You've been signed out."
      : params.verified === "1"
        ? "Your email is confirmed. Log in to continue."
        : params.demo === "unavailable"
          ? "The demo account isn't available on this deployment. Create a free account instead."
          : params.error === "link"
            ? "That link is invalid or has expired. Please try again."
            : null;
  return (
    <div className="grid gap-4">
      {notice && (
        <p role="status" className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          {notice}
        </p>
      )}
      <LoginForm next={next} defaultEmail={typeof params.email === "string" ? params.email : undefined} />
    </div>
  );
}
