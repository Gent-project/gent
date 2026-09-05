import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service - Gent | Version Control Platform",
  description: "Review Gent's terms of service and conditions for using our version control platform.",
  keywords: "terms of service, terms and conditions, user agreement, legal",
  openGraph: {
    title: "Terms of Service - Gent",
    description: "Understand the terms and conditions for using Gent.",
    type: "website",
  },
};

export default function TermsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
