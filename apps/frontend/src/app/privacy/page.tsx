"use client";

import { Shield } from "lucide-react";
import LegalPage from "@/app/components/site/LegalPage";

const sections = [
  { title: "1. Information We Collect", content: "We collect information you provide directly to us, such as when you create an account, use our services, or contact us. This includes your name, email address, password, and any other information you choose to provide. We also automatically collect certain information about your device and how you interact with our services, including IP address, browser type, and usage data." },
  { title: "2. How We Use Your Information", content: "We use the information we collect to provide, maintain, and improve our services, process transactions, send transactional and promotional communications, and comply with legal obligations. We may also use your information to personalize your experience, analyze usage patterns, and develop new features and services." },
  { title: "3. Information Sharing", content: "We do not sell, trade, or rent your personal information to third parties. We may share your information with service providers who assist us in operating our website and conducting our business, subject to confidentiality agreements. We may also disclose information when required by law or to protect our rights and safety." },
  { title: "4. Data Security", content: "We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the internet or electronic storage is completely secure. We cannot guarantee absolute security of your information." },
  { title: "5. Cookies and Tracking", content: "We use cookies and similar tracking technologies to enhance your experience on our platform. These technologies help us remember your preferences, understand how you use our services, and deliver personalized content. You can control cookie settings through your browser, though some features may not function properly if cookies are disabled." },
  { title: "6. Your Rights and Choices", content: "You have the right to access, update, or delete your personal information at any time by logging into your account or contacting us. You can also opt-out of promotional communications by following the unsubscribe instructions in our emails. Depending on your location, you may have additional rights regarding your personal data." },
  { title: "7. Data Retention", content: "We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this privacy policy. You can request deletion of your account and associated data at any time, subject to legal and operational requirements." },
  { title: "8. Third-Party Links", content: "Our website may contain links to third-party websites and services that are not operated by Gent. This privacy policy does not apply to third-party websites, and we are not responsible for their privacy practices. We encourage you to review the privacy policies of any third-party services before providing your information." },
  { title: "9. Children's Privacy", content: "Gent is not intended for children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will take steps to delete such information and terminate the child's account." },
  { title: "10. Changes to This Policy", content: "We may update this privacy policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. We will notify you of any material changes by posting the updated policy on our website and updating the 'Last Updated' date. Your continued use of our services constitutes your acceptance of the updated policy." },
  { title: "11. Contact Us", content: "If you have questions about this privacy policy or our privacy practices, please contact us at privacy@gent.com. We will respond to your inquiry within 30 days. You can also reach out to our Data Protection Officer for privacy-related concerns." },
];

export default function Privacy() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Privacy Policy"
      intro="How Gent collects, uses, and protects your personal information."
      icon={Shield}
      lastUpdated="August 2026"
      sections={sections}
    />
  );
}
