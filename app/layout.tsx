import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Noto_Sans_Devanagari, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";
import ThemeToggle from "@/components/ThemeToggle";

const geist = Geist({
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
    "Plain-language contract summaries, verified risk clauses, calendar deadlines, and deterministic cost engine with regional read-aloud.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${notoDevanagari.variable} ${notoTamil.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* Inline script sets dark class before first paint — eliminates flash */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('cs-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col"
        style={{ backgroundColor: "var(--surface-page)", color: "var(--text-primary)", fontFamily: "var(--font-primary, 'Geist', system-ui, sans-serif)" }}>

        {/* ── Header ── */}
        <header className="sticky top-0 z-40 w-full border-b backdrop-blur"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "color-mix(in srgb, var(--surface-card) 90%, transparent)" }}>
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <span
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white font-bold text-lg shadow-sm transition-all group-hover:scale-105 group-hover:shadow-md"
                style={{ background: "linear-gradient(135deg, #4f46e5, #6366f1)" }}
              >
                ✓
              </span>
              <div className="flex flex-col">
                <span className="font-extrabold tracking-tight text-lg leading-tight"
                  style={{ color: "var(--text-primary)" }}>
                  ClearSign
                </span>
                <span className="text-[10px] font-semibold tracking-widest uppercase hidden xs:block"
                  style={{ color: "var(--brand-500)" }}>
                  Understand before you agree
                </span>
              </div>
            </Link>

            {/* Right side */}
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold border"
                style={{
                  background: "color-mix(in srgb, var(--brand-50) 80%, transparent)",
                  color: "var(--brand-600)",
                  borderColor: "var(--brand-200)",
                }}>
                <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: "#4ade80" }} />
                Zero storage · Every quote verified
              </span>
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* ── Main ── */}
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
          {children}
        </main>

        {/* ── Footer ── */}
        <footer className="w-full border-t py-6 px-4 text-center text-xs space-y-1.5"
          style={{ borderColor: "var(--surface-border)", backgroundColor: "var(--surface-card)", color: "var(--text-muted)" }}>
          <p className="font-medium" style={{ color: "var(--text-secondary)" }}>
            Reading aid, not legal advice. For important decisions, consult a qualified professional.
          </p>
          <p>
            Every quoted clause is verified word-for-word against your document.
          </p>
        </footer>
      </body>
    </html>
  );
}
