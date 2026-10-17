import { NextResponse, type NextRequest } from "next/server";
import { getBackend } from "@/lib/backend";
import { addDays, daysBetween, todayString, toDateString } from "@/lib/dates";
import { serverEnv } from "@/lib/env.server";

/**
 * Daily automation (scheduled in vercel.json): notifies assignees about overdue
 * tasks and project teams about deadlines in the next 3 days. Idempotent: it
 * never sends the same reminder twice.
 * Requires `Authorization: Bearer $CRON_SECRET` (Vercel Cron sends this automatically).
 */
export async function GET(request: NextRequest) {
  if (!serverEnv.cronSecret || request.headers.get("authorization") !== `Bearer ${serverEnv.cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getBackend().adminDb();
  if (!db) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is required for scheduled jobs" }, { status: 503 });

  const today = todayString();
  const horizon = toDateString(addDays(new Date(), 3));
  const [{ rows: overdueTasks }, { rows: dueProjects }, { rows: existing }] = await Promise.all([
    db.select("tasks", { lt: { due_date: today }, neq: { status: "done" } }),
    db.select("projects", { gte: { due_date: today }, lte: { due_date: horizon }, in: { status: ["planning", "active", "in_review"] } }),
    db.select("notifications", { in: { type: ["task_overdue", "project_deadline"] }, gte: { created_at: addDays(new Date(), -30).toISOString() } }),
  ]);
  const sent = new Set(existing.map((n) => `${n.type}:${n.user_id}:${n.link}`));
  const outbox: Parameters<typeof db.insertMany<"notifications">>[1] = [];

  for (const task of overdueTasks) {
    if (!task.assignee_id) continue;
    const link = `/dashboard/tasks?task=${task.id}`;
    if (sent.has(`task_overdue:${task.assignee_id}:${link}`)) continue;
    outbox.push({ workspace_id: task.workspace_id, user_id: task.assignee_id, type: "task_overdue", title: `Task overdue: ${task.title}`, body: `It was due ${task.due_date}.`, link, read_at: null });
  }

  if (dueProjects.length) {
    const { rows: members } = await db.select("project_members", { in: { project_id: dueProjects.map((p) => p.id) } });
    for (const project of dueProjects) {
      const link = `/dashboard/projects/${project.id}`;
      const days = daysBetween(today, project.due_date!);
      const recipients = new Set([project.owner_id, ...members.filter((m) => m.project_id === project.id).map((m) => m.user_id)].filter((x): x is string => !!x));
      for (const userId of recipients) {
        if (sent.has(`project_deadline:${userId}:${link}`)) continue;
        outbox.push({
          workspace_id: project.workspace_id,
          user_id: userId,
          type: "project_deadline",
          title: `${project.name} is due ${days === 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}`,
          body: `Progress is at ${project.progress}%.`,
          link,
          read_at: null,
        });
      }
    }
  }

  if (outbox.length) await db.insertMany("notifications", outbox);
  return NextResponse.json({ ok: true, sent: outbox.length });
}
