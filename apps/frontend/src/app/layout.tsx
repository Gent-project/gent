import type { Metadata } from "next";
import { Cairo } from "next/font/google";

import "./globals.css";

import { Providers } from "@/components/providers/providers";
import { Toaster } from "sonner";

/**
 * Cairo is loaded once and exposed as the default sans + mono CSS variable.
 * It supports Arabic and Latin glyphs, so the UI is RTL-friendly out of the box.
 * The variable name `--font-cairo` is referenced from `globals.css`.
 */
const cairo = Cairo({
  subsets: ["latin", "arabic"],
  variable: "--font-cairo",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Gent — Modern Version Control",
    template: "%s · Gent",
  },
  description:
    "Gent is a modern, Git-like version control platform with a fast CLI and a beautiful web dashboard. Push from your terminal, watch it appear here instantly.",
  applicationName: "Gent",
  icons: { icon: "/logo.png" },
  openGraph: {
    title: "Gent — Modern Version Control",
    description:
      "Push from your terminal, see it instantly on the web. Built for teams that want Git's power without its sharp edges.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Inline theme bootstrap — runs before paint so we never flash the wrong
         * theme. The user's preference is stored under "gent-theme". */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => {
              try {
                const stored = localStorage.getItem('gent-theme');
                const prefers = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const dark = stored ? stored === 'dark' : prefers;
                document.documentElement.classList.toggle('dark', dark);
              } catch (e) {}
            })();`,
          }}
        />
      </head>
      <body className={`${cairo.variable} font-sans antialiased`}>
        <Providers>
          {children}
          <Toaster
            position="top-center"
            richColors
            closeButton
            toastOptions={{ style: { fontFamily: "var(--font-cairo)" } }}
          />
        </Providers>
      </body>
    </html>
  );
}
