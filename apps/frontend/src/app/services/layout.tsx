export const metadata = {
  title: "Services - Gent Version Control Platform",
  description: "Explore Gent's comprehensive services for version control, team collaboration, and code management. Repository management, pull requests, CI/CD integration, and more.",
  keywords: "version control services, git hosting, code collaboration, repository management, CI/CD",
  openGraph: {
    title: "Services - Gent Version Control Platform",
    description: "Comprehensive version control and collaboration services for developers",
    type: "website",
  },
};

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
