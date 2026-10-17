import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Terms of Service" };

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated="October 17, 2026">
      <p>
        These terms govern your use of FlowPilot. Replace this template with terms reviewed by your counsel before
        launch.
      </p>
      <section>
        <h2>Accounts</h2>
        <p>
          You&apos;re responsible for keeping your login credentials secure and for activity in workspaces you own. You
          must provide accurate account information.
        </p>
      </section>
      <section>
        <h2>Subscriptions and billing</h2>
        <ul>
          <li>Paid plans are billed monthly in advance through Stripe.</li>
          <li>You can upgrade, downgrade or cancel at any time from billing settings.</li>
          <li>Downgrades take effect when they fit your current usage, such as the number of users.</li>
        </ul>
      </section>
      <section>
        <h2>Your content</h2>
        <p>
          You own the data you put into FlowPilot. You grant us permission to host and process it only to provide the
          service to you and your team.
        </p>
      </section>
      <section>
        <h2>Acceptable use</h2>
        <p>Don&apos;t misuse the service, attempt to access other workspaces, or upload malicious files.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions about these terms can be sent to legal@flowpilot.example.</p>
      </section>
    </LegalPage>
  );
}
