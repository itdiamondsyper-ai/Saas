import { daysBetween, todayString } from "@/lib/dates";
import type { ProjectRow } from "@/types/database";

/**
 * A project is at risk when it is still open and either past its due date,
 * or due within a week with less than 70% of the work done.
 */
export function isProjectAtRisk(project: Pick<ProjectRow, "status" | "due_date" | "progress">, now: Date = new Date()): boolean {
  if (project.status === "completed" || project.status === "on_hold" || !project.due_date) return false;
  const daysLeft = daysBetween(todayString(now), project.due_date);
  return daysLeft < 0 || (daysLeft <= 7 && project.progress < 70);
}

export type HealthBucket = "Active" | "Completed" | "At Risk" | "On Hold";

export function healthBucket(project: Pick<ProjectRow, "status" | "due_date" | "progress">, now?: Date): HealthBucket {
  if (project.status === "completed") return "Completed";
  if (project.status === "on_hold") return "On Hold";
  return isProjectAtRisk(project, now) ? "At Risk" : "Active";
}
