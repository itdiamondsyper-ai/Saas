"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { FormError, FormField, fieldA11y } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { createClientAction, updateClientAction } from "@/lib/actions/records";
import { CLIENT_STATUSES } from "@/lib/constants";
import { clientSchema, type ClientInput } from "@/lib/validation/schemas";
import type { ClientRow } from "@/types/database";

function toValues(client?: ClientRow | null): ClientInput {
  return {
    company: client?.company ?? "",
    contactName: client?.contact_name ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    website: client?.website ?? "",
    industry: client?.industry ?? "",
    address: client?.address ?? "",
    status: client?.status ?? "active",
    tags: client?.tags.join(", ") ?? "",
    notes: client?.notes ?? "",
  };
}

export function ClientFormDialog({
  open,
  onOpenChange,
  client,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientRow | null;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const form = useForm<ClientInput, unknown, z.output<typeof clientSchema>>({ resolver: zodResolver(clientSchema), defaultValues: toValues(client) });
  const { errors } = form.formState;
  const err = (k: keyof ClientInput) => errors[k]?.message as string | undefined;

  useEffect(() => {
    if (open) {
      form.reset(toValues(client));
      setError(null);
    }
  }, [open, client, form, setError]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run(
      () => (client ? updateClientAction({ id: client.id, values }) : createClientAction(values)),
      { success: client ? "Client updated" : "Client created" },
    );
    if (result.ok) {
      onOpenChange(false);
      onSaved?.(result.data.id);
      router.refresh();
    } else {
      applyFieldErrors(form, result.fieldErrors);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{client ? "Edit client" : "New client"}</DialogTitle>
          <DialogDescription>{client ? `Update details for ${client.company}.` : "Add a client or lead to your CRM."}</DialogDescription>
        </DialogHeader>
        <form id="client-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error && !Object.keys(errors).length ? error : null} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="company" label="Company" error={err("company")} required>
              <Input {...fieldA11y("company", err("company"))} className="h-9" {...form.register("company")} />
            </FormField>
            <FormField id="contactName" label="Contact name" error={err("contactName")} required>
              <Input {...fieldA11y("contactName", err("contactName"))} className="h-9" {...form.register("contactName")} />
            </FormField>
            <FormField id="client-email" label="Email" error={err("email")}>
              <Input {...fieldA11y("client-email", err("email"))} type="email" className="h-9" {...form.register("email")} />
            </FormField>
            <FormField id="phone" label="Phone" error={err("phone")}>
              <Input {...fieldA11y("phone", err("phone"))} type="tel" className="h-9" {...form.register("phone")} />
            </FormField>
            <FormField id="website" label="Website" error={err("website")}>
              <Input {...fieldA11y("website", err("website"))} placeholder="example.com" className="h-9" {...form.register("website")} />
            </FormField>
            <FormField id="industry" label="Industry" error={err("industry")}>
              <Input {...fieldA11y("industry", err("industry"))} className="h-9" {...form.register("industry")} />
            </FormField>
            <FormField id="status" label="Status" error={err("status")}>
              <NativeSelect {...fieldA11y("status", err("status"))} {...form.register("status")}>
                {CLIENT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="tags" label="Tags" error={err("tags")} hint="Separate with commas">
              <Input {...fieldA11y("tags", err("tags"))} placeholder="retainer, design" className="h-9" {...form.register("tags")} />
            </FormField>
          </div>
          <FormField id="address" label="Address" error={err("address")}>
            <Input {...fieldA11y("address", err("address"))} className="h-9" {...form.register("address")} />
          </FormField>
          <FormField id="notes" label="Notes" error={err("notes")}>
            <Textarea {...fieldA11y("notes", err("notes"))} rows={3} {...form.register("notes")} />
          </FormField>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="client-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {client ? "Save changes" : "Create client"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
