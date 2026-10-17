"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { moveTaskAction } from "@/lib/actions/records";
import { TASK_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/database";
import { TaskCardBody, type BoardTask } from "./task-card";

type Columns = Record<TaskStatus, BoardTask[]>;

function group(tasks: BoardTask[]): Columns {
  const columns = Object.fromEntries(TASK_STATUSES.map((s) => [s.value, [] as BoardTask[]])) as Columns;
  for (const t of [...tasks].sort((a, b) => a.position - b.position)) columns[t.status].push(t);
  return columns;
}

function SortableTask({ task, onOpen, disabled }: { task: BoardTask; onOpen: (id: string) => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-manipulation", isDragging && "opacity-40")}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={() => onOpen(task.id)}
        aria-roledescription={disabled ? undefined : "Draggable task"}
        aria-label={`${task.title}. ${disabled ? "Open task" : "Press space to pick up, or enter to open"}`}
        data-testid="task-card"
        className="block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onOpen(task.id);
            return;
          }
          listeners?.onKeyDown?.(e);
        }}
      >
        <TaskCardBody task={task} className="transition-shadow hover:shadow-sm" />
      </button>
    </li>
  );
}

function Column({
  status,
  label,
  tasks,
  onOpen,
  onAdd,
  canWrite,
}: {
  status: TaskStatus;
  label: string;
  tasks: BoardTask[];
  onOpen: (id: string) => void;
  onAdd: (status: TaskStatus) => void;
  canWrite: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}` });
  return (
    <section
      aria-label={`${label} column`}
      data-testid={`column-${status}`}
      className={cn("flex w-[17rem] shrink-0 flex-col rounded-xl border bg-muted/40 2xl:w-auto 2xl:min-w-0 2xl:flex-1", isOver && "ring-2 ring-primary/30")}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          {label}
          <span className="rounded-full bg-background px-1.5 text-xs text-muted-foreground tabular">{tasks.length}</span>
        </h2>
        {canWrite && (
          <button type="button" onClick={() => onAdd(status)} aria-label={`Add task to ${label}`} className="rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground">
            <Plus className="size-4" />
          </button>
        )}
      </header>
      <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
          {tasks.map((t) => (
            <SortableTask key={t.id} task={t} onOpen={onOpen} disabled={!canWrite} />
          ))}
          {tasks.length === 0 && <li className="rounded-lg border border-dashed py-6 text-center text-xs text-muted-foreground">No tasks</li>}
        </ul>
      </SortableContext>
    </section>
  );
}

export function KanbanBoard({
  tasks,
  onOpen,
  onAdd,
  canWrite,
}: {
  tasks: BoardTask[];
  onOpen: (id: string) => void;
  onAdd: (status: TaskStatus) => void;
  canWrite: boolean;
}) {
  const [columns, setColumns] = useState<Columns>(() => group(tasks));
  const [activeId, setActiveId] = useState<string | null>(null);
  // Re-sync with server data after each refresh.
  const [lastTasks, setLastTasks] = useState(tasks);
  if (tasks !== lastTasks) {
    setLastTasks(tasks);
    setColumns(group(tasks));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findColumn = (id: string): TaskStatus | null => {
    if (id.startsWith("column:")) return id.slice(7) as TaskStatus;
    return (Object.keys(columns) as TaskStatus[]).find((s) => columns[s].some((t) => t.id === id)) ?? null;
  };
  const activeTask = useMemo(() => (activeId ? Object.values(columns).flat().find((t) => t.id === activeId) ?? null : null), [activeId, columns]);

  const onDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));

  // Move cards across columns while dragging so the drop target previews correctly.
  const onDragOver = (e: DragOverEvent) => {
    const overId = e.over?.id ? String(e.over.id) : null;
    if (!overId) return;
    const from = findColumn(String(e.active.id));
    const to = findColumn(overId);
    if (!from || !to || from === to) return;
    setColumns((prev) => {
      const task = prev[from].find((t) => t.id === e.active.id);
      if (!task) return prev;
      const target = prev[to].filter((t) => t.id !== task.id);
      const index = overId.startsWith("column:") ? target.length : Math.max(target.findIndex((t) => t.id === overId), 0);
      target.splice(index, 0, { ...task, status: to });
      return { ...prev, [from]: prev[from].filter((t) => t.id !== task.id), [to]: target };
    });
  };

  const onDragEnd = async (e: DragEndEvent) => {
    setActiveId(null);
    const id = String(e.active.id);
    const overId = e.over?.id ? String(e.over.id) : null;
    const original = tasks.find((t) => t.id === id);
    const status = overId ? findColumn(overId) : null;
    if (!original || !status) {
      setColumns(group(tasks));
      return;
    }
    let column = columns[status];
    if (overId && !overId.startsWith("column:") && overId !== id) {
      const fromIndex = column.findIndex((t) => t.id === id);
      const toIndex = column.findIndex((t) => t.id === overId);
      if (fromIndex !== -1 && toIndex !== -1) {
        column = [...column];
        const [moved] = column.splice(fromIndex, 1);
        column.splice(toIndex, 0, moved);
        setColumns((prev) => ({ ...prev, [status]: column }));
      }
    }
    const index = column.findIndex((t) => t.id === id);
    const beforeId = index >= 0 && index < column.length - 1 ? column[index + 1].id : null;
    const unchanged = original.status === status && beforeId === (group(tasks)[status][group(tasks)[status].findIndex((t) => t.id === id) + 1]?.id ?? null);
    if (unchanged) return;
    const result = await moveTaskAction({ id, status, beforeId }).catch(() => null);
    if (!result?.ok) {
      toast.error(result?.error ?? "We couldn't move that task. Please try again.");
      setColumns(group(tasks));
    } else if (status === "done" && original.status !== "done") {
      toast.success(`“${original.title}” completed`);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        setColumns(group(tasks));
      }}
      accessibility={{
        announcements: {
          onDragStart: ({ active }) => `Picked up task ${activeTask?.title ?? active.id}.`,
          onDragOver: ({ over }) => (over ? `Over ${String(over.id).startsWith("column:") ? String(over.id).slice(7) : "another task"}.` : "Not over a column."),
          onDragEnd: ({ over }) => (over ? "Task dropped." : "Task returned."),
          onDragCancel: () => "Move cancelled.",
        },
      }}
    >
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {TASK_STATUSES.map((s) => (
          <Column key={s.value} status={s.value} label={s.label} tasks={columns[s.value]} onOpen={onOpen} onAdd={onAdd} canWrite={canWrite} />
        ))}
      </div>
      <DragOverlay>{activeTask ? <TaskCardBody task={activeTask} className="rotate-1 shadow-lg" /> : null}</DragOverlay>
    </DndContext>
  );
}
