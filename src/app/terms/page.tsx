import type { Metadata } from "next";
import { MarketingPage } from "@/components/layout/marketing-page";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms of service that govern your use of Gent.",
};

/** /terms — terms of service. */
export default function TermsPage() {
  return (
    <MarketingPage
      eyebrow="Legal"
      title="Terms of Service"
      subtitle="Use Gent in good faith and Gent will return the favour."
      updated="June 2026"
    >
      <p>
        By creating an account or using the Gent CLI you agree to these terms.
        They're intentionally short; if anything is unclear, write us at{" "}
        <a href="mailto:hello@gent.dev">hello@gent.dev</a>.
      </p>

      <h2>1. Your account</h2>
      <p>
        You are responsible for keeping your password and tokens secret. If you
        suspect either has been compromised, run <code>gent logout</code> and
        change your password immediately.
      </p>

      <h2>2. Acceptable use</h2>
      <ul>
        <li>Don't host malware, phishing kits or content that is illegal where Gent or its users live.</li>
        <li>Don't attempt to disrupt the service or other users' projects.</li>
        <li>Don't try to circumvent rate limits or authentication.</li>
      </ul>

      <h2>3. Your content</h2>
      <p>
        Whatever you push stays yours. By using Gent you grant us only the
        minimum licence we need to store, transmit and display your content to
        you and the collaborators you authorise.
      </p>

      <h2>4. Free service</h2>
      <p>
        Gent is currently free for personal use. No credit card is required.
        We reserve the right to introduce paid tiers in the future, with at
        least 30 days' notice and no retroactive charges.
      </p>

      <h2>5. Availability</h2>
      <p>
        We work hard on uptime but don't guarantee 100%. The API and dashboard
        are provided "as is" without warranty. Don't use Gent as your only
        backup — push copies elsewhere too.
      </p>

      <h2>6. Termination</h2>
      <p>
        You can delete your account at any time. We may suspend or terminate
        accounts that violate these terms. We'll always tell you why, unless
        legally restricted from doing so.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may update these terms. Material changes will be announced via
        email and will not take effect for at least 14 days, giving you time
        to review and, if you disagree, export your data and close your
        account.
      </p>
    </MarketingPage>
  );
}
