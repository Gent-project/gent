import Atmosphere from "./Atmosphere";
import SharedNavigation from "../SharedNavigation";
import SharedFooter from "../SharedFooter";
import ScrollDepth from "./ScrollDepth";

/** Standard marketing-page frame: atmosphere backdrop, nav, content, footer. */
export default function SiteShell({
  children,
  footer = true,
}: {
  children: React.ReactNode;
  footer?: boolean;
}) {
  return (
    <div className="relative min-h-screen">
      <Atmosphere />
      <SharedNavigation />
      <ScrollDepth />
      <main className="relative overflow-x-clip">{children}</main>
      {footer && <SharedFooter />}
    </div>
  );
}
