import type { Metadata } from "next";
import Link from "next/link";
import {
  Inter,
  Noto_Sans_Devanagari,
  Noto_Sans_Tamil,
} from "next/font/google";
import { Lock, CheckSquare } from "lucide-react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-primary",
});

const notoDevanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-devanagari",
});

const notoTamil = Noto_Sans_Tamil({
  subsets: ["tamil"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-noto-tamil",
});

export const metadata: Metadata = {
  title: "ClearSign — Understand before you agree",
  description:
    "Paste or upload any contract. ClearSign flags the hidden traps, quotes them word for word, and explains them in your language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${notoDevanagari.variable} ${notoTamil.variable} dark h-full antialiased`}
      style={{ colorScheme: "dark" }}
    >
      <head>
        <meta name="theme-color" content="#0A0A0B" />
      </head>
      <body
        className="min-h-full flex flex-col"
        style={{
          backgroundColor: "var(--background)",
          color: "var(--foreground)",
          fontFamily: "var(--font-primary)",
        }}
      >
        {/* Skip-to-content for keyboard users */}
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>

        {/* ── Header ── */}
        <header
          className="sticky top-0 z-40 w-full border-b"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--surface)",
            height: "64px",
          }}
        >
          <div className="mx-auto flex h-full max-w-3xl items-center justify-between px-4 sm:px-6">
            {/* Logo */}
            <Link
              href="/"
              className="flex items-center gap-2.5 group"
              aria-label="ClearSign home"
            >
              {/* Amber rounded-square logo mark */}
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl transition-all group-hover:scale-105"
                style={{ backgroundColor: "var(--primary)" }}
              >
                <CheckSquare
                  className="h-5 w-5"
                  style={{ color: "var(--primary-foreground)" }}
                  strokeWidth={2}
                />
              </span>
              <span
                className="font-extrabold tracking-tight text-lg leading-none"
                style={{ color: "var(--foreground)" }}
              >
                ClearSign
              </span>
            </Link>

            {/* Right side: Nothing stored pill */}
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--foreground-2)",
                borderColor: "var(--border-strong)",
              }}
            >
              <Lock className="h-3.5 w-3.5" strokeWidth={1.75} />
              Nothing stored
            </span>
          </div>
        </header>

        {/* ── Main ── */}
        <main
          id="main-content"
          className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8"
        >
          {children}
        </main>

        {/* ── Footer ── */}
        <footer
          className="w-full border-t py-5 px-4 text-center text-xs space-y-1"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--muted)",
          }}
        >
          <p>Reading aid, not legal advice.</p>
          <p>Team Nexora · HACKDAY 1.0</p>
        </footer>
      </body>
    </html>
  );
}
