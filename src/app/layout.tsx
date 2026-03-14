import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import CommandPalette from "@/components/command-palette";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Raise | Series C Process Orchestrator",
  description: "AI-powered fundraising process management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`} style={{ background: 'var(--surface-0)', color: 'var(--text-primary)' }}>
        <ToastProvider>
          <CommandPalette />
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
