import type { Metadata } from "next";
import { DashboardProvider } from "./_components/DashboardContext";

export const metadata: Metadata = {
  title: "Dashboard – Gent",
  description: "Manage your repositories, branches, and commits on Gent.",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardProvider>{children}</DashboardProvider>;
}
