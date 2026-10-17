"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { FormField, fieldA11y } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { createWorkspaceAction } from "@/lib/actions/workspace";
import { createWorkspaceSchema } from "@/lib/validation/schemas";

export function CreateWorkspaceForm({ onCreated }: { onCreated?: () => void }) {
  const router = useRouter();
  const { run, pending } = useAction();
  const form = useForm<z.input<typeof createWorkspaceSchema>>({
    resolver: zodResolver(createWorkspaceSchema),
    defaultValues: { name: "" },
  });
  const error = form.formState.errors.name?.message;

  return (
    <form
      noValidate
      className="grid gap-4"
      onSubmit={form.handleSubmit(async (values) => {
        const result = await run(() => createWorkspaceAction(values), { success: "Workspace created" });
        if (result.ok) {
          onCreated?.();
          router.push(result.data.redirectTo);
          router.refresh();
        } else applyFieldErrors(form, result.fieldErrors);
      })}
    >
      <FormField id="workspace-name" label="Workspace name" error={error}>
        <Input {...fieldA11y("workspace-name", error)} placeholder="e.g. Northwind Studio" className="h-9" {...form.register("name")} />
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending && <Loader2 className="animate-spin" />}
        Create workspace
      </Button>
    </form>
  );
}
