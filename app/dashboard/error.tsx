"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center gap-4 py-20 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" aria-hidden />
      </span>
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">This page couldn&apos;t load</h1>
        <p className="text-sm text-muted-foreground">
          Something went wrong while loading your data. Your work is safe. Try again, or head back to the overview.
        </p>
        {error.digest && <p className="pt-1 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p>}
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>
          <RotateCw /> Try again
        </Button>
        <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
          Go to overview
        </Link>
      </div>
    </div>
  );
}
