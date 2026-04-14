import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "./providers";
import ReduxProvider from "./redux-provider";
import { Toaster } from "sonner";
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gent – Lightweight Version Control & Code Hosting Platform",
  description:
    "Gent is a lightweight version control system with a Git-like CLI and a GitHub-inspired web interface for managing repositories, commits, and collaboration.",
    icons: {
    icon: "/logo.png",
  },
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Toaster position="top-center" richColors />
        <ReduxProvider>
          <QueryProvider>
            {children}
            </QueryProvider>
        </ReduxProvider>
      </body>
    </html>
  );
}
