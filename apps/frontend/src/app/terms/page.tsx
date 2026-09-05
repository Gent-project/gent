"use client";

import { FileText } from "lucide-react";
import LegalPage from "@/app/components/site/LegalPage";

const sections = [
  { title: "1. Acceptance of Terms", content: "By accessing and using Gent, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service. We reserve the right to make changes to these terms at any time without notice." },
  { title: "2. Use License", content: "Permission is granted to temporarily download one copy of the materials (information or software) on Gent for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not: modify or copy the materials; use the materials for any commercial purpose or for any public display; attempt to decompile or reverse engineer any software contained on Gent; remove any copyright or other proprietary notations from the materials; or transfer the materials to another person or 'mirror' the materials on any other server." },
  { title: "3. Disclaimer", content: "The materials on Gent are provided on an 'as is' basis. Gent makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights." },
  { title: "4. Limitations", content: "In no event shall Gent or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on Gent, even if Gent or an authorized representative has been notified orally or in writing of the possibility of such damage." },
  { title: "5. Accuracy of Materials", content: "The materials appearing on Gent could include technical, typographical, or photographic errors. Gent does not warrant that any of the materials on its website are accurate, complete, or current. Gent may make changes to the materials contained on its website at any time without notice." },
  { title: "6. Materials and Content", content: "Gent has not reviewed all of the sites linked to its website and is not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by Gent of the site. Use of any such linked website is at the user's own risk. If you believe that your work has been copied in a way that constitutes copyright infringement, please provide written notice to our copyright agent." },
  { title: "7. Modifications", content: "Gent may revise these terms of service for its website at any time without notice. By using this website, you are agreeing to be bound by the then current version of these terms of service. We reserve the right to modify or discontinue, temporarily or permanently, the website (or any part thereof) with or without notice." },
  { title: "8. Governing Law", content: "These terms and conditions are governed by and construed in accordance with the laws of the jurisdiction in which Gent operates, and you irrevocably submit to the exclusive jurisdiction of the courts in that location. If any provision of these terms is found to be invalid or unenforceable, the remaining provisions shall remain in full force and effect." },
  { title: "9. User Accounts", content: "If you create an account on Gent, you are responsible for maintaining the confidentiality of your account information and password and for restricting access to your computer. You agree to accept responsibility for all activities that occur under your account or password. You must notify us immediately of any unauthorized use of your account." },
  { title: "10. Prohibited Activities", content: "You agree not to use Gent for any unlawful purpose or in any way that could damage, disable, or impair the service. Prohibited behavior includes harassing or causing distress or inconvenience to any person, transmitting obscene or offensive content, disrupting the normal flow of dialogue within our website, or attempting to gain unauthorized access to our systems." },
  { title: "11. Intellectual Property Rights", content: "All content included on Gent, such as text, graphics, logos, images, and software, is the property of Gent or its content suppliers and is protected by international copyright laws. The compilation of all content on Gent is the exclusive property of Gent and is protected by international copyright laws." },
  { title: "12. Limitation of Liability", content: "In no event shall Gent, its directors, employees, or agents be liable to you or any third party for any indirect, incidental, special, consequential, or punitive damages arising out of or in connection with your use of the website or these terms of service, even if Gent has been advised of the possibility of such damages." },
  { title: "13. Contact Information", content: "If you have any questions about these Terms of Service, please contact us at legal@gent.com. We will respond to your inquiry within 30 days. You can also reach out to our legal team for any concerns or disputes regarding these terms." },
];

export default function Terms() {
  return (
    <LegalPage
      eyebrow="Legal"
      title="Terms of Service"
      intro="The terms that govern your use of Gent's CLI, API, and web dashboard."
      icon={FileText}
      lastUpdated="August 2026"
      sections={sections}
    />
  );
}
