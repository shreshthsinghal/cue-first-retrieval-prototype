import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Cue First: a retrieval workflow that accepts memory's format",
  description:
    "Standalone research prototype: describe a partly-remembered photo the way you remember it. Multi-hypothesis retrieval, automatic escalation, one clarification at most, and every outcome explained. Built on the cue-format mismatch problem definition.",
  keywords: ["photo retrieval", "memory cues", "search prototype", "research", "Google Photos"],
  authors: [{ name: "Recall Research" }],
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Cue First: retrieval that accepts memory's format",
    description:
      "Memory keeps fragments: relative time, visual pieces, event anchors. This prototype runs a retrieval workflow that translates them instead of demanding keywords.",
    siteName: "Cue First",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
