import { BarChart3, CheckSquare, FileText, FolderKanban, LayoutDashboard, Users } from "lucide-react";
import { LogoMark } from "@/components/shared/logo";

// A lightweight, static rendering of the real dashboard for the landing page.
const BARS = [42, 48, 45, 55, 58, 52, 63, 65, 60, 67, 70, 79];
const KPIS = [
  { label: "Revenue this month", value: "$18,420", change: "+12.4%", good: true },
  { label: "Outstanding", value: "$27,910", change: "-4.1%", good: true },
  { label: "Active clients", value: "8", change: "+14.3%", good: true },
  { label: "Active projects", value: "6", change: "+20.0%", good: true },
];
const ACTIVITY = [
  { who: "SL", text: "Sarah completed Design Homepage", time: "25m" },
  { who: "$", text: "Invoice #INV-1042 was paid", time: "2h" },
  { who: "MT", text: "Project Atlas Website moved to In Review", time: "3h" },
];

export function DashboardPreview() {
  return (
    <div
      role="img"
      aria-label="Preview of the FlowPilot dashboard showing revenue, KPIs and recent activity"
      className="overflow-hidden rounded-xl border bg-card shadow-[0_30px_80px_-30px_rgba(40,40,90,0.35)] ring-1 ring-foreground/5"
    >
      <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2">
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="ml-3 rounded-md bg-background px-2 py-0.5 text-[10px] text-muted-foreground">app.flowpilot.io/dashboard</span>
      </div>
      <div className="grid grid-cols-[150px_1fr] text-left max-sm:grid-cols-1">
        <aside className="space-y-1 border-r bg-sidebar p-3 max-sm:hidden">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold">
            <LogoMark className="size-5" /> Vertex Creative
          </div>
          {[
            [LayoutDashboard, "Overview", true],
            [Users, "Clients"],
            [FolderKanban, "Projects"],
            [CheckSquare, "Tasks"],
            [FileText, "Invoices"],
            [BarChart3, "Analytics"],
          ].map(([Icon, label, active]) => {
            const I = Icon as typeof Users;
            return (
              <div
                key={label as string}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${active ? "bg-sidebar-accent font-medium" : "text-muted-foreground"}`}
              >
                <I className="size-3.5" /> {label as string}
              </div>
            );
          })}
        </aside>
        <div className="space-y-3 p-3 sm:p-4">
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            {KPIS.map((k) => (
              <div key={k.label} className="rounded-lg border bg-background p-2.5">
                <p className="text-[10px] text-muted-foreground">{k.label}</p>
                <p className="mt-0.5 text-sm font-semibold tabular">{k.value}</p>
                <p className="text-[10px] font-medium text-success">{k.change}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-2 lg:grid-cols-[1.6fr_1fr]">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-[11px] font-medium">Revenue · last 12 months</p>
              <div className="mt-3 flex h-28 items-end gap-1.5">
                {BARS.map((h, i) => (
                  <div
                    key={i}
                    className={`flex-1 rounded-t-sm ${i === BARS.length - 1 ? "bg-primary" : "bg-primary/25"}`}
                    style={{ height: `${h}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="space-y-2 rounded-lg border bg-background p-3">
              <p className="text-[11px] font-medium">Recent activity</p>
              {ACTIVITY.map((a) => (
                <div key={a.text} className="flex items-start gap-2">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[8px] font-semibold text-primary">
                    {a.who}
                  </span>
                  <p className="flex-1 text-[10px] leading-snug">{a.text}</p>
                  <span className="text-[9px] text-muted-foreground">{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
