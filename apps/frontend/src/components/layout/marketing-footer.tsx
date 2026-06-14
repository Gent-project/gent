import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { PATHS } from "@/lib/paths";

/** Simple marketing-mode footer. */
export function MarketingFooter() {
  return (
    <footer className="border-t border-outline-variant bg-surface-container-low">
      <div className="mx-auto max-w-7xl px-4 sm:px-8 py-10 grid gap-8 md:grid-cols-4">
        <div className="space-y-3">
          <Logo size={32} />
          <p className="text-sm text-on-surface-variant max-w-xs">
            Modern, Git-shaped version control. Fast CLI, beautiful web,
            zero ceremony.
          </p>
        </div>
        {[
          {
            title: "Product",
            links: [
              { href: PATHS.cli, label: "CLI Explorer" },
              { href: "/#features", label: "Features" },
              { href: "/#how", label: "How it works" },
            ],
          },
          {
            title: "Resources",
            links: [
              { href: PATHS.faq, label: "FAQ" },
              { href: PATHS.auth.signup, label: "Sign up" },
              { href: PATHS.auth.login, label: "Sign in" },
            ],
          },
          {
            title: "Legal",
            links: [
              { href: PATHS.privacy, label: "Privacy" },
              { href: PATHS.terms, label: "Terms" },
            ],
          },
        ].map((group) => (
          <div key={group.title}>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">
              {group.title}
            </h4>
            <ul className="space-y-2 text-sm">
              {group.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-foreground hover:text-primary transition">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-outline-variant py-4 text-center text-xs text-on-surface-variant">
        © {new Date().getFullYear()} Gent. All rights reserved.
      </div>
    </footer>
  );
}
