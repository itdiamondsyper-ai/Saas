"use client";

import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAction } from "@/hooks/use-action";
import { acceptInvitationAction } from "@/lib/actions/auth";

export function AcceptInviteButton({ token, workspaceName }: { token: string; workspaceName: string }) {
  const router = useRouter();
  const { run, pending } = useAction();
  return (
    <Button
      size="lg"
      className="w-full"
      disabled={pending}
      onClick={async () => {
        const result = await run(() => acceptInvitationAction(token), { success: `Welcome to ${workspaceName}!` });
        if (result.ok) {
          router.replace(result.data.redirectTo);
          router.refresh();
        }
      }}
    >
      {pending && <Loader2 className="animate-spin" />}
      Accept invitation
    </Button>
  );
}
