import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CreateWorkspaceForm } from "@/components/onboarding/create-workspace-form";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Logo } from "@/components/shared/logo";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser, getWorkspaceContext } from "@/lib/server/context";

export const metadata: Metadata = { title: "Set up your workspace" };

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5 sm:px-6">
        <Link href="/" aria-label="FlowPilot home">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto max-w-xl px-4 pb-16 sm:px-6">
        <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
          <OnboardingContent />
        </Suspense>
      </main>
    </div>
  );
}

async function OnboardingContent() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/onboarding");
  const ctx = await getWorkspaceContext();
  if (!ctx) {
    return (
      <div className="rounded-xl border bg-card p-6 shadow-xs">
        <h1 className="text-xl font-semibold tracking-tight">Create your workspace</h1>
        <p className="mt-1 text-sm text-muted-foreground">A workspace holds your clients, projects, invoices and team.</p>
        <div className="mt-6">
          <CreateWorkspaceForm />
        </div>
      </div>
    );
  }
  if (ctx.workspace.onboarding_completed || ctx.role !== "owner") redirect("/dashboard");
  return (
    <OnboardingWizard
      firstName={ctx.profile.full_name.split(" ")[0] || "there"}
      initial={{
        name: ctx.workspace.name,
        industry: ctx.workspace.industry ?? "",
        teamSize: ctx.workspace.team_size ?? "",
        goal: ctx.workspace.primary_goal ?? "",
      }}
    />
  );
}
