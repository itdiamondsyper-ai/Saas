import type { Metadata } from "next";
import Link from "next/link";
import { LifeBuoy, Mail, MessagesSquare } from "lucide-react";

export const metadata: Metadata = { title: "Contact" };

const CHANNELS = [
  { icon: Mail, title: "Sales", body: "Questions about plans, pricing or a team rollout.", href: "mailto:sales@flowpilot.example", cta: "sales@flowpilot.example" },
  { icon: LifeBuoy, title: "Support", body: "Help with your workspace, billing or an issue you ran into.", href: "mailto:support@flowpilot.example", cta: "support@flowpilot.example" },
  { icon: MessagesSquare, title: "Partnerships", body: "Integrations, agencies and reseller programs.", href: "mailto:partners@flowpilot.example", cta: "partners@flowpilot.example" },
];

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Get in touch</h1>
      <p className="mt-2 max-w-xl text-muted-foreground">
        We usually reply within one business day. Business plan customers get priority support.
      </p>
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {CHANNELS.map((c) => (
          <div key={c.title} className="rounded-xl border bg-card p-5">
            <c.icon className="size-5 text-primary" aria-hidden />
            <h2 className="mt-3 font-medium">{c.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{c.body}</p>
            <Link href={c.href} className="mt-4 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">
              {c.cta}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
