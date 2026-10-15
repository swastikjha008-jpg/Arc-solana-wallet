import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { AsciiBackground } from "@/components/ascii/AsciiBackground";

export const metadata: Metadata = {
  title: "arc — Solana cloud wallet",
  description: "arc is a Devnet Solana cloud wallet. Not audited. Do not use real funds.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#05060a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen antialiased">
        <AsciiBackground />
        {children}
      </body>
    </html>
  );
}
