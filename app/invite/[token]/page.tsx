import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { MailWarning, UsersRound } from "lucide-react";
import { AcceptInviteButton } from "@/components/team/accept-invite-button";
import { Logo } from "@/components/shared/logo";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getBackend } from "@/lib/backend";
import { ROLE_LABELS } from "@/lib/permissions";
import { getSessionUser } from "@/lib/server/context";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Join a workspace" };

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/30 px-4 py-10">
      <Link href="/" aria-label="FlowPilot home" className="mb-10">
        <Logo />
      </Link>
      <div className="w-full max-w-md rounded-xl border bg-card p-6 text-center shadow-xs">
        <Suspense fallback={<Skeleton className="h-40 w-full" />}>
          <InviteContent params={params} />
        </Suspense>
      </div>
    </div>
  );
}

async function InviteContent({ params }: Pick<PageProps<"/invite/[token]">, "params">) {
  const { token } = await params;
  const [invitation, user] = await Promise.all([getBackend().getInvitation(token), getSessionUser()]);

  if (!invitation || invitation.expired || invitation.accepted) {
    return (
      <div className="space-y-3">
        <MailWarning className="mx-auto size-8 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold">
          {invitation?.accepted ? "This invitation was already used" : "This invitation is no longer valid"}
        </h1>
        <p className="text-sm text-muted-foreground">Ask the person who invited you to send a new invitation.</p>
        <Link href={user ? "/dashboard" : "/login"} className={cn(buttonVariants({ variant: "outline" }), "mt-2")}>
          {user ? "Go to dashboard" : "Log in"}
        </Link>
      </div>
    );
  }

  const emailMatches = user && user.email.toLowerCase() === invitation.email.toLowerCase();
  return (
    <div className="space-y-4">
      <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
        <UsersRound className="size-5" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Join {invitation.workspaceName} on FlowPilot</h1>
        <p className="text-sm text-muted-foreground">
          You&apos;ve been invited as <strong>{ROLE_LABELS[invitation.role]}</strong> using {invitation.email}.
        </p>
      </div>
      {user ? (
        emailMatches ? (
          <AcceptInviteButton token={token} workspaceName={invitation.workspaceName} />
        ) : (
          <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            You&apos;re signed in as {user.email}. Log out and sign in as {invitation.email} to accept.
          </p>
        )
      ) : (
        <div className="grid gap-2">
          <Link
            href={`/signup?invite=${encodeURIComponent(token)}&email=${encodeURIComponent(invitation.email)}`}
            className={buttonVariants({ size: "lg" })}
          >
            Create an account
          </Link>
          <Link href={`/login?next=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(invitation.email)}`} className={buttonVariants({ variant: "outline", size: "lg" })}>
            I already have an account
          </Link>
        </div>
      )}
    </div>
  );
}
