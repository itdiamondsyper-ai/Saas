"use client";

import { useCallback, useState, useTransition } from "react";
import type { FieldValues, Path, UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/server/action";

/** Copies server-side field errors onto a react-hook-form instance. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts forms with any transformed output type
export function applyFieldErrors<T extends FieldValues>(form: UseFormReturn<T, any, any>, fieldErrors?: Record<string, string>) {
  if (!fieldErrors) return;
  for (const [name, message] of Object.entries(fieldErrors)) {
    // Update actions wrap input as { id, values }; map those paths back to form fields.
    form.setError(name.replace(/^values\./, "") as Path<T>, { type: "server", message });
  }
}

/**
 * Runs a server action inside a transition and reports the outcome with a toast.
 * Returns the result so callers can react to success (close a dialog, navigate).
 */
export function useAction() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    <T,>(action: () => Promise<ActionResult<T>>, messages: { success?: string; error?: string } = {}) =>
      new Promise<ActionResult<T>>((resolve) => {
        setError(null);
        startTransition(async () => {
          let result: ActionResult<T>;
          try {
            result = await action();
          } catch {
            result = { ok: false, error: "We couldn't reach the server. Check your connection and try again." };
          }
          if (result.ok) {
            if (messages.success) toast.success(messages.success);
          } else {
            setError(result.error);
            if (!result.fieldErrors) toast.error(messages.error ?? result.error);
          }
          resolve(result);
        });
      }),
    [],
  );

  return { run, pending, error, setError };
}
