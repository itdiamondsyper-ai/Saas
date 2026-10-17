"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import { FormError, FormField, fieldA11y } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { createProjectAction, updateProjectAction } from "@/lib/actions/records";
import { PRIORITIES, PROJECT_STATUSES } from "@/lib/constants";
import { projectSchema, type ProjectInput } from "@/lib/validation/schemas";
import type { ProjectRow } from "@/types/database";

export interface Option {
  id: string;
  label: string;
}

function toValues(project: ProjectRow | null | undefined, memberIds: string[], defaults: { clientId?: string; ownerId?: string }): ProjectInput {
  return {
    name: project?.name ?? "",
    clientId: project?.client_id ?? defaults.clientId ?? "",
    ownerId: project?.owner_id ?? defaults.ownerId ?? "",
    status: project?.status ?? "active",
    priority: project?.priority ?? "medium",
    startDate: project?.start_date ?? "",
    dueDate: project?.due_date ?? "",
    budget: project ? Number(project.budget) : 0,
    progress: project?.progress ?? 0,
    description: project?.description ?? "",
    memberIds,
  };
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  memberIds = [],
  clients,
  members,
  hasTasks = false,
  defaultClientId,
  currentUserId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project?: ProjectRow | null;
  memberIds?: string[];
  clients: Option[];
  members: Option[];
  hasTasks?: boolean;
  defaultClientId?: string;
  currentUserId: string;
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const form = useForm<ProjectInput, unknown, z.output<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: toValues(project, memberIds, { clientId: defaultClientId, ownerId: currentUserId }),
  });
  const { errors } = form.formState;
  const selectedMembers = useWatch({ control: form.control, name: "memberIds" }) ?? [];

  useEffect(() => {
    if (open) {
      form.reset(toValues(project, memberIds, { clientId: defaultClientId, ownerId: currentUserId }));
      setError(null);
    }
    // memberIds is derived per render; reset only when the dialog opens or the record changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project, defaultClientId]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run(() => (project ? updateProjectAction({ id: project.id, values }) : createProjectAction(values)), {
      success: project ? "Project updated" : "Project created",
    });
    if (result.ok) {
      onOpenChange(false);
      onSaved?.(result.data.id);
      router.refresh();
    } else applyFieldErrors(form, result.fieldErrors);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{project ? "Edit project" : "New project"}</DialogTitle>
          <DialogDescription>{project ? `Update ${project.name}.` : "Set up the scope, timeline and team."}</DialogDescription>
        </DialogHeader>
        <form id="project-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error && !Object.keys(errors).length ? error : null} />
          <FormField id="project-name" label="Project name" error={errors.name?.message} required>
            <Input {...fieldA11y("project-name", errors.name?.message)} className="h-9" {...form.register("name")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="project-client" label="Client" error={errors.clientId?.message}>
              <NativeSelect {...fieldA11y("project-client", errors.clientId?.message)} {...form.register("clientId")}>
                <option value="">No client (internal)</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="project-owner" label="Owner" error={errors.ownerId?.message}>
              <NativeSelect {...fieldA11y("project-owner", errors.ownerId?.message)} {...form.register("ownerId")}>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="project-status" label="Status">
              <NativeSelect id="project-status" {...form.register("status")}>
                {PROJECT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="project-priority" label="Priority">
              <NativeSelect id="project-priority" {...form.register("priority")}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="project-start" label="Start date" error={errors.startDate?.message}>
              <Input {...fieldA11y("project-start", errors.startDate?.message)} type="date" className="h-9" {...form.register("startDate")} />
            </FormField>
            <FormField id="project-due" label="Due date" error={errors.dueDate?.message}>
              <Input {...fieldA11y("project-due", errors.dueDate?.message)} type="date" className="h-9" {...form.register("dueDate")} />
            </FormField>
            <FormField id="project-budget" label="Budget (USD)" error={errors.budget?.message}>
              <Input {...fieldA11y("project-budget", errors.budget?.message)} type="number" min={0} step="100" inputMode="decimal" className="h-9" {...form.register("budget")} />
            </FormField>
            <FormField
              id="project-progress"
              label="Progress (%)"
              error={errors.progress?.message}
              hint={hasTasks ? "Calculated from completed tasks" : undefined}
            >
              <Input
                {...fieldA11y("project-progress", errors.progress?.message)}
                type="number"
                min={0}
                max={100}
                disabled={hasTasks}
                className="h-9"
                {...form.register("progress")}
              />
            </FormField>
          </div>
          <FormField id="project-description" label="Description" error={errors.description?.message}>
            <Textarea {...fieldA11y("project-description", errors.description?.message)} rows={3} {...form.register("description")} />
          </FormField>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">Project members</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {members.map((m) => {
                const checked = selectedMembers.includes(m.id);
                return (
                  <label key={m.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        form.setValue("memberIds", value ? [...selectedMembers, m.id] : selectedMembers.filter((id) => id !== m.id), { shouldDirty: true })
                      }
                    />
                    {m.label}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="project-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {project ? "Save changes" : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
