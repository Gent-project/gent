import type { Metadata } from "next";
import { MarketingPage } from "@/components/layout/marketing-page";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Gent collects, how we use it, and the choices you have over your data.",
};

/** /privacy — short, plain-English privacy policy. */
export default function PrivacyPage() {
  return (
    <MarketingPage
      eyebrow="Legal"
      title="Privacy Policy"
      subtitle="Plain English. No dark patterns. You always own your code."
      updated="June 2026"
    >
      <p>
        This policy explains what data Gent collects, why we collect it, and
        the controls you have over it. If anything here is unclear, email us
        at <a href="mailto:hello@gent.dev">hello@gent.dev</a> and we'll
        rewrite it until it isn't.
      </p>

      <h2>1. What we collect</h2>
      <p>
        When you create an account, we collect your <code>email</code>, your
        <code>first_name</code> and <code>last_name</code> (optional), and a
        salted hash of your password. We never see, store or log the plain-text
        password.
      </p>
      <p>
        When you use Gent we store the contents you push: repositories,
        commits, branches, tags, trees and blobs. This is the whole point of
        the product. You decide what's pushed; you can delete it at any time.
      </p>

      <h2>2. What we do with it</h2>
      <ul>
        <li>Authenticate you — JWT tokens are issued by the API on login.</li>
        <li>Render your dashboard — your projects, commits and branches.</li>
        <li>Send transactional emails (verification, password reset). No marketing.</li>
      </ul>
      <p>We don't sell your data. We don't share it with third-party advertisers.</p>

      <h2>3. Cookies & local storage</h2>
      <p>
        Gent stores your access and refresh tokens in <code>localStorage</code>
        under <code>gent.access</code> and <code>gent.refresh</code> so you stay
        signed in. Your chosen theme is stored under <code>gent-theme</code>.
        Clearing your browser storage signs you out.
      </p>

      <h2>4. Your rights</h2>
      <ul>
        <li>Export every repository at any time using the CLI: <code>gent clone</code>.</li>
        <li>Delete a project: dashboard → project → <em>Delete</em>.</li>
        <li>Delete your account: email <a href="mailto:hello@gent.dev">hello@gent.dev</a>.</li>
      </ul>

      <h2>5. Where data lives</h2>
      <p>
        Gent's API is hosted at <code>gent-api.onrender.com</code>. Database
        backups run nightly and are retained for 14 days, then permanently
        deleted.
      </p>

      <h2>6. Children</h2>
      <p>Gent is not directed at children under 13 and we don't knowingly collect their data.</p>

      <h2>7. Changes to this policy</h2>
      <p>
        We'll update this page and bump the "Last updated" date at the top if
        anything material changes. Substantive changes will be announced via
        email before they take effect.
      </p>
    </MarketingPage>
  );
}
