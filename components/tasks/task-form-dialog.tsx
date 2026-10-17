"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { Loader2 } from "lucide-react";
import type { Option } from "@/components/projects/project-form-dialog";
import { FormError, FormField, fieldA11y } from "@/components/shared/form-field";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { applyFieldErrors, useAction } from "@/hooks/use-action";
import { createTaskAction, updateTaskAction } from "@/lib/actions/records";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import { taskSchema, type TaskInput } from "@/lib/validation/schemas";
import type { TaskRow, TaskStatus } from "@/types/database";

export interface TaskFormDefaults {
  projectId?: string | null;
  status?: TaskStatus;
  assigneeId?: string | null;
}

function toValues(task: TaskRow | null | undefined, defaults: TaskFormDefaults): TaskInput {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    projectId: task?.project_id ?? defaults.projectId ?? "",
    assigneeId: task?.assignee_id ?? defaults.assigneeId ?? "",
    status: task?.status ?? defaults.status ?? "todo",
    priority: task?.priority ?? "medium",
    dueDate: task?.due_date ?? "",
    labels: task?.labels.join(", ") ?? "",
  };
}

export function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaults = {},
  projects,
  members,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: TaskRow | null;
  defaults?: TaskFormDefaults;
  projects: Option[];
  members: Option[];
  onSaved?: (id: string) => void;
}) {
  const router = useRouter();
  const { run, pending, error, setError } = useAction();
  const form = useForm<TaskInput, unknown, z.output<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: toValues(task, defaults),
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (open) {
      form.reset(toValues(task, defaults));
      setError(null);
    }
    // Reset only when the dialog opens or switches task.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  const onSubmit = form.handleSubmit(async (values) => {
    const result = await run(() => (task ? updateTaskAction({ id: task.id, values }) : createTaskAction(values)), {
      success: task ? "Task updated" : "Task created",
    });
    if (result.ok) {
      onOpenChange(false);
      onSaved?.(result.data.id);
      router.refresh();
    } else applyFieldErrors(form, result.fieldErrors);
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task ? "Edit task" : "New task"}</DialogTitle>
          <DialogDescription>{task ? "Update the task details." : "Capture the work and who owns it."}</DialogDescription>
        </DialogHeader>
        <form id="task-form" onSubmit={onSubmit} noValidate className="grid gap-4">
          <FormError message={error && !Object.keys(errors).length ? error : null} />
          <FormField id="task-title" label="Title" error={errors.title?.message} required>
            <Input {...fieldA11y("task-title", errors.title?.message)} className="h-9" {...form.register("title")} />
          </FormField>
          <FormField id="task-description" label="Description" error={errors.description?.message}>
            <Textarea {...fieldA11y("task-description", errors.description?.message)} rows={3} {...form.register("description")} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="task-project" label="Project">
              <NativeSelect id="task-project" {...form.register("projectId")}>
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="task-assignee" label="Assignee">
              <NativeSelect id="task-assignee" {...form.register("assigneeId")}>
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="task-status" label="Status">
              <NativeSelect id="task-status" {...form.register("status")}>
                {TASK_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="task-priority" label="Priority">
              <NativeSelect id="task-priority" {...form.register("priority")}>
                {PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </NativeSelect>
            </FormField>
            <FormField id="task-due" label="Due date" error={errors.dueDate?.message}>
              <Input {...fieldA11y("task-due", errors.dueDate?.message)} type="date" className="h-9" {...form.register("dueDate")} />
            </FormField>
            <FormField id="task-labels" label="Labels" error={errors.labels?.message} hint="Separate with commas">
              <Input {...fieldA11y("task-labels", errors.labels?.message)} placeholder="design, client" className="h-9" {...form.register("labels")} />
            </FormField>
          </div>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="task-form" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />}
            {task ? "Save changes" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
