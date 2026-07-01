import { ReactNode } from "react";

/**
 * Layout barrel for the authenticated app section.
 * Page-level `AppShell` provides the actual chrome — this exists so we can
 * later attach group-level metadata or middlewares without rewriting pages.
 */
export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
