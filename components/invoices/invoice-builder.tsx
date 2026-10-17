"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { FormError, FormField, fieldA11y } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { createInvoiceAction, updateInvoiceAction } from "@/lib/actions/records";
import { formatCurrency } from "@/lib/format";
import { invoiceSchema, type InvoiceInput } from "@/lib/validation/schemas";

interface ProjectOption {
  id: string;
  label: string;
  clientId: string | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function InvoiceBuilder({
  invoiceId,
  number,
  initial,
  clients,
  projects,
}: {
  invoiceId?: string;
  number: string;
  initial: InvoiceInput;
  clients: { id: string; label: string }[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  const form = useForm<InvoiceInput, unknown, z.output<typeof invoiceSchema>>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: initial,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = useWatch({ control: form.control, name: "items" });
  const taxRate = Number(useWatch({ control: form.control, name: "taxRate" })) || 0;
  const clientId = useWatch({ control: form.control, name: "clientId" });
  const { errors } = form.formState;

  const totals = useMemo(() => {
    const lines = (items ?? []).map((i) => round2((Number(i?.quantity) || 0) * (Number(i?.unitPrice) || 0)));
    const subtotal = round2(lines.reduce((s, l) => s + l, 0));
    const tax = round2((subtotal * taxRate) / 100);
    return { lines, subtotal, tax, total: round2(subtotal + tax) };
  }, [items, taxRate]);

  const clientProjects = projects.filter((p) => !p.clientId || p.clientId === clientId);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run(() => (invoiceId ? updateInvoiceAction({ id: invoiceId, values }) : createInvoiceAction(values)), {
      success: invoiceId ? "Invoice updated" : "Draft invoice created",
    });
    if (result.ok) {
      router.push(`/dashboard/invoices/${result.data.id}`);
      router.refresh();
    } else applyFieldErrors(form, result.fieldErrors);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormError message={error && !Object.keys(errors).length ? error : null} />
      <section className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-4">
          <p className="text-xs text-muted-foreground">Invoice number</p>
          <p className="text-lg font-semibold tabular">{number}</p>
        </div>
        <FormField id="inv-client" label="Client" error={errors.clientId?.message} required className="sm:col-span-2">
          <NativeSelect
            {...fieldA11y("inv-client", errors.clientId?.message)}
            {...form.register("clientId", {
              onChange: () => {
                const projectId = form.getValues("projectId");
                const project = projects.find((p) => p.id === projectId);
                if (project?.clientId && project.clientId !== form.getValues("clientId")) form.setValue("projectId", "");
              },
            })}
          >
            <option value="">Select a client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="inv-project" label="Project" className="sm:col-span-2">
          <NativeSelect id="inv-project" {...form.register("projectId")}>
            <option value="">No project</option>
            {clientProjects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </NativeSelect>
        </FormField>
        <FormField id="inv-issue" label="Issue date" error={errors.issueDate?.message} required>
          <Input {...fieldA11y("inv-issue", errors.issueDate?.message)} type="date" className="h-9" {...form.register("issueDate")} />
        </FormField>
        <FormField id="inv-due" label="Due date" error={errors.dueDate?.message} required>
          <Input {...fieldA11y("inv-due", errors.dueDate?.message)} type="date" className="h-9" {...form.register("dueDate")} />
        </FormField>
        <FormField id="inv-tax" label="Tax rate (%)" error={errors.taxRate?.message}>
          <Input {...fieldA11y("inv-tax", errors.taxRate?.message)} type="number" min={0} max={100} step="0.01" inputMode="decimal" className="h-9" {...form.register("taxRate")} />
        </FormField>
      </section>

      <section className="rounded-xl border bg-card">
        <header className="flex items-center justify-between border-b px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Line items</h2>
          {errors.items?.message && <p className="text-xs text-destructive">{errors.items.message}</p>}
        </header>
        <div className="hidden grid-cols-[1fr_100px_120px_120px_40px] gap-3 px-5 pt-3 text-xs font-medium text-muted-foreground md:grid">
          <span>Description</span>
          <span>Qty / hours</span>
          <span>Rate</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <ul className="divide-y md:divide-y-0">
          {fields.map((field, index) => {
            const e = errors.items?.[index];
            return (
              <li key={field.id} className="grid grid-cols-2 gap-3 p-4 md:grid-cols-[1fr_100px_120px_120px_40px] md:items-start md:px-5 md:py-2">
                <div className="col-span-2 md:col-span-1">
                  <label htmlFor={`item-${index}-desc`} className="mb-1 block text-xs text-muted-foreground md:sr-only">
                    Description
                  </label>
                  <Input
                    {...fieldA11y(`item-${index}-desc`, e?.description?.message)}
                    placeholder="e.g. Website design"
                    className="h-9"
                    {...form.register(`items.${index}.description`)}
                  />
                  {e?.description && <p className="mt-1 text-xs text-destructive">{e.description.message}</p>}
                </div>
                <div>
                  <label htmlFor={`item-${index}-qty`} className="mb-1 block text-xs text-muted-foreground md:sr-only">
                    Quantity
                  </label>
                  <Input {...fieldA11y(`item-${index}-qty`, e?.quantity?.message)} type="number" min={0} step="0.25" inputMode="decimal" className="h-9" {...form.register(`items.${index}.quantity`)} />
                  {e?.quantity && <p className="mt-1 text-xs text-destructive">{e.quantity.message}</p>}
                </div>
                <div>
                  <label htmlFor={`item-${index}-rate`} className="mb-1 block text-xs text-muted-foreground md:sr-only">
                    Rate
                  </label>
                  <Input {...fieldA11y(`item-${index}-rate`, e?.unitPrice?.message)} type="number" min={0} step="0.01" inputMode="decimal" className="h-9" {...form.register(`items.${index}.unitPrice`)} />
                  {e?.unitPrice && <p className="mt-1 text-xs text-destructive">{e.unitPrice.message}</p>}
                </div>
                <p className="self-center text-sm font-medium tabular md:text-right" aria-label={`Line ${index + 1} amount`}>
                  {formatCurrency(totals.lines[index] ?? 0, "USD", { cents: true })}
                </p>
                <Button type="button" variant="ghost" size="icon" className="justify-self-end" aria-label={`Remove line ${index + 1}`} disabled={fields.length === 1} onClick={() => remove(index)}>
                  <Trash2 />
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="border-t px-4 py-3 sm:px-5">
          <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}>
            <Plus /> Add line item
          </Button>
        </div>
        <dl className="ml-auto grid w-full max-w-xs gap-2 border-t px-4 py-4 text-sm sm:px-5">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="tabular" data-testid="invoice-subtotal">{formatCurrency(totals.subtotal, "USD", { cents: true })}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Tax ({taxRate}%)</dt>
            <dd className="tabular" data-testid="invoice-tax">{formatCurrency(totals.tax, "USD", { cents: true })}</dd>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <dt>Total</dt>
            <dd className="tabular" data-testid="invoice-total">{formatCurrency(totals.total, "USD", { cents: true })}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-xl border bg-card p-4 sm:p-5">
        <FormField id="inv-notes" label="Notes to client" error={errors.notes?.message}>
          <Textarea {...fieldA11y("inv-notes", errors.notes?.message)} rows={3} placeholder="Payment terms, bank details or a thank-you note." {...form.register("notes")} />
        </FormField>
      </section>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="animate-spin" />}
          {invoiceId ? "Save invoice" : "Create draft invoice"}
        </Button>
      </div>
    </form>
  );
}
