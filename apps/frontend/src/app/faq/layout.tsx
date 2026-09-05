import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "FAQ - Gent | Frequently Asked Questions",
  description: "Find answers to common questions about Gent version control system. Learn about features, pricing, security, and more.",
  keywords: "FAQ, frequently asked questions, Gent, version control, help, support",
  openGraph: {
    title: "FAQ - Gent",
    description: "Find answers to common questions about Gent version control system.",
    type: "website",
  },
};

export default function FAQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
