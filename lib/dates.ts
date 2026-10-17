// Date helpers. Calendar dates (due dates, issue dates) are stored as YYYY-MM-DD
// strings and compared in UTC so server and client agree on "today".

const DAY_MS = 86_400_000;

export function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayString(now: Date = new Date()): string {
  return toDateString(now);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function dateFromString(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((dateFromString(to).getTime() - dateFromString(from).getTime()) / DAY_MS);
}

export function startOfMonthUTC(date: Date, monthOffset = 0): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + monthOffset, 1));
}

export function monthKey(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
}

/** Keys for the last `count` calendar months, oldest first, ending with the current month. */
export function lastMonthKeys(count: number, now: Date = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => monthKey(startOfMonthUTC(now, i - (count - 1))));
}

export function isOverdue(dueDate: string | null, now: Date = new Date()): boolean {
  return !!dueDate && dueDate < todayString(now);
}
