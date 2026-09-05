import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - Gent | Version Control Platform",
  description: "Read Gent's privacy policy to understand how we collect, use, and protect your personal information.",
  keywords: "privacy policy, data protection, personal information, GDPR, privacy",
  openGraph: {
    title: "Privacy Policy - Gent",
    description: "Learn how Gent protects your privacy and personal data.",
    type: "website",
  },
};

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
