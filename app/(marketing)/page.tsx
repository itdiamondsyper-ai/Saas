import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  FileText,
  FolderKanban,
  ShieldCheck,
  Users,
  UsersRound,
  Workflow,
} from "lucide-react";
import { DashboardPreview } from "@/components/marketing/dashboard-preview";
import { Button, buttonVariants } from "@/components/ui/button";
import { startDemoAction } from "@/lib/actions/demo";
import { PLAN_ORDER, PLANS } from "@/lib/plans";
import { cn } from "@/lib/utils";

const CUSTOMERS = ["Northstar Studio", "Vertex Labs", "Oak & Co.", "Lunar Creative", "Atlas Consulting"];

const FEATURES = [
  { icon: Users, title: "Client management", body: "A lightweight CRM with contacts, notes, tags, files and lifetime revenue for every client." },
  { icon: FolderKanban, title: "Projects and tasks", body: "Plan projects with budgets and timelines, then run the work on a Kanban board or table." },
  { icon: FileText, title: "Invoicing", body: "Build itemized invoices with tax in seconds, track what's outstanding and download PDFs." },
  { icon: BarChart3, title: "Analytics", body: "Revenue, profit, retention and workload charts that update as your business moves." },
  { icon: UsersRound, title: "Team collaboration", body: "Invite teammates with Owner, Admin, Member or Viewer roles and comment on tasks together." },
  { icon: Workflow, title: "Automated workflows", body: "Overdue invoices flag themselves, project progress follows completed tasks, and deadlines surface early." },
  { icon: Bell, title: "Notifications", body: "Get notified when invoices are paid, tasks are assigned or a project deadline is close." },
  { icon: ShieldCheck, title: "Secure cloud workspace", body: "Every workspace is isolated with row-level security, and every action lands in an audit trail." },
];

const FAQ = [
  {
    q: "Is there really a free plan?",
    a: "Yes. Starter is free forever for one user with up to 3 active projects and 10 clients. Every new workspace also gets a 14-day Pro trial, no card required.",
  },
  {
    q: "Can I invite my team?",
    a: "Pro includes 5 users and Business includes 20. Each person gets a role, so you control who can edit records, manage the team or handle billing.",
  },
  {
    q: "How does invoicing work?",
    a: "Create invoices with multiple line items and tax, mark them as sent or paid, duplicate recurring work and download a PDF to send to your client.",
  },
  {
    q: "Is my data secure?",
    a: "Data is stored in Postgres with row-level security, so a workspace's records are only visible to its members. Passwords are handled by our auth provider and never stored by FlowPilot.",
  },
  {
    q: "Can I change plans later?",
    a: "Anytime. Upgrades take effect immediately, and you can downgrade or cancel from billing settings.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section id="product" className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] bg-[radial-gradient(60%_60%_at_50%_0%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent)]"
        />
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 text-center sm:px-6 sm:pt-24">
          <p className="mx-auto mb-5 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-success" /> New: analytics with project profitability
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Run your business without juggling 10 different tools.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-pretty text-muted-foreground sm:text-lg">
            Manage clients, projects, invoices, team activity, and business performance from one workspace.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-10 px-5")}>
              Start Free <ArrowRight />
            </Link>
            <form action={startDemoAction}>
              <Button type="submit" variant="outline" size="lg" className="h-10 px-5">
                View Demo
              </Button>
            </form>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Free forever plan · 14-day Pro trial · No credit card</p>
          <div className="mx-auto mt-12 max-w-5xl sm:mt-16">
            <DashboardPreview />
          </div>
        </div>
      </section>

      <section id="customers" aria-labelledby="customers-title" className="border-y bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 id="customers-title" className="text-center text-sm text-muted-foreground">
            Trusted by studios, consultancies and agencies that run lean
          </h2>
          <ul className="mt-6 grid grid-cols-2 items-center gap-6 sm:grid-cols-3 lg:grid-cols-5">
            {CUSTOMERS.map((name) => (
              <li key={name} className="flex items-center justify-center gap-2 text-muted-foreground">
                <span aria-hidden className="flex size-6 items-center justify-center rounded-md bg-foreground/8 text-[10px] font-bold">
                  {name[0]}
                </span>
                <span className="text-sm font-semibold tracking-tight">{name}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-medium text-primary">Everything in one place</p>
          <h2 id="features-title" className="mt-2 text-3xl font-semibold tracking-tight text-balance">
            The tools you&apos;re paying for separately, finally working together
          </h2>
          <p className="mt-3 text-muted-foreground">
            FlowPilot connects the client, the project, the work and the invoice, so your numbers are always up to date.
          </p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-5 transition-shadow hover:shadow-sm">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-4.5" aria-hidden />
              </span>
              <h3 className="mt-4 font-medium">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" aria-labelledby="pricing-title" className="border-t bg-muted/30">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 id="pricing-title" className="text-3xl font-semibold tracking-tight">
              Simple pricing that grows with you
            </h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade when your team does.</p>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {PLAN_ORDER.map((id) => {
              const plan = PLANS[id];
              const featured = id === "pro";
              return (
                <div
                  key={id}
                  className={cn(
                    "relative flex flex-col rounded-xl border bg-card p-6",
                    featured && "border-primary/50 shadow-lg ring-1 ring-primary/30",
                  )}
                >
                  {featured && (
                    <span className="absolute -top-3 left-6 rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
                      Most popular
                    </span>
                  )}
                  <h3 className="font-semibold">{plan.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.description}</p>
                  <p className="mt-5 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight">{plan.price === 0 ? "Free" : `$${plan.price}`}</span>
                    {plan.price > 0 && <span className="text-sm text-muted-foreground">/month</span>}
                  </p>
                  <ul className="mt-6 flex-1 space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={id === "starter" ? "/signup" : `/signup?plan=${id}`}
                    className={cn(buttonVariants({ variant: featured ? "default" : "outline", size: "lg" }), "mt-8 h-10")}
                  >
                    {id === "starter" ? "Start Free" : `Start ${plan.name} trial`}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section id="faq" aria-labelledby="faq-title" className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <h2 id="faq-title" className="text-center text-3xl font-semibold tracking-tight">
          Frequently asked questions
        </h2>
        <div className="mt-10 divide-y rounded-xl border bg-card">
          {FAQ.map((item) => (
            <details key={item.q} className="group px-5 py-4 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-md font-medium">
                {item.q}
                <span aria-hidden className="text-muted-foreground transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="border-t">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-5 px-4 py-16 text-center sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">Bring your whole business into one workspace</h2>
          <p className="max-w-xl text-muted-foreground">Set up takes about two minutes. Import a client, create a project, and send your first invoice today.</p>
          <Link href="/signup" className={cn(buttonVariants({ size: "lg" }), "h-10 px-5")}>
            Start Free <ArrowRight />
          </Link>
        </div>
      </section>
    </>
  );
}
