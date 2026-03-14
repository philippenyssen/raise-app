import type { Metadata } from "next";
import { DM_Sans, Cormorant_Garamond, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/toast";
import CommandPalette from "@/components/command-palette";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Raise | Series C Process Orchestrator",
  description: "AI-powered fundraising process management — track investors, meetings, follow-ups, and deal momentum in one place.",
  openGraph: {
    title: "Raise | Series C Process Orchestrator",
    description: "AI-powered fundraising process management — track investors, meetings, follow-ups, and deal momentum in one place.",
    siteName: "Raise",
    type: "website",
  },
  other: {
    "theme-color": "#09090f",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${dmSans.variable} ${cormorant.variable} ${geistMono.variable} antialiased`} style={{ background: 'var(--surface-0)', color: 'var(--text-primary)' }}>
        <ToastProvider>
          <CommandPalette />
          <AppShell>{children}</AppShell>
        </ToastProvider>
      </body>
    </html>
  );
}
