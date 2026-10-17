import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated="October 17, 2026">
      <p>
        This policy explains what information FlowPilot collects, how we use it and the choices you have. Replace this
        template with your company&apos;s reviewed policy before launch.
      </p>
      <section>
        <h2>Information we collect</h2>
        <ul>
          <li>Account details such as your name, email address and workspace name.</li>
          <li>Business records you add to your workspace, including clients, projects, tasks and invoices.</li>
          <li>Billing information processed by our payment provider, Stripe. We never store full card numbers.</li>
          <li>Usage data such as sign-in times and device type, used to secure your account.</li>
        </ul>
      </section>
      <section>
        <h2>How we use information</h2>
        <p>
          We use your information to provide the service, keep your workspace secure, process payments, send
          service-related emails and improve the product. We don&apos;t sell personal information.
        </p>
      </section>
      <section>
        <h2>Data isolation and security</h2>
        <p>
          Each workspace is isolated with database row-level security. Only members of a workspace can access its
          records. Data is encrypted in transit and at rest by our infrastructure providers.
        </p>
      </section>
      <section>
        <h2>Your choices</h2>
        <p>
          You can update your profile, export your data on request, and delete your account at any time from Settings →
          Security. Deleting your account removes workspaces you solely own.
        </p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions about privacy can be sent to privacy@flowpilot.example.</p>
      </section>
    </LegalPage>
  );
}
