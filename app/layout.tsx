import type { Metadata } from "next";
import Link from "next/link";
import { Inter, Noto_Sans_Devanagari, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
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
      className={`${inter.variable} ${notoDevanagari.variable} ${notoTamil.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans selection:bg-teal-100 selection:text-teal-900">
        <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 group">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-700 text-white font-bold text-lg shadow-sm group-hover:bg-teal-800 transition-colors">
                ✓
              </span>
              <div className="flex flex-col">
                <span className="font-bold text-slate-900 tracking-tight text-lg leading-tight">
                  ClearSign
                </span>
                <span className="text-[10px] text-teal-700 font-medium tracking-wide uppercase hidden xs:block">
                  Understand before you agree
                </span>
              </div>
            </Link>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 border border-emerald-200/60">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Zero storage · 100% verified
              </span>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6">
          {children}
        </main>

        <footer className="w-full border-t border-slate-200 bg-white py-6 px-4 text-center text-xs text-slate-500 space-y-1.5">
          <p className="font-medium text-slate-700">
            Reading aid, not legal advice. For important decisions, consult a qualified professional.
          </p>
          <p className="text-slate-500">
            ClearSign does not store your documents. All analysis is verified word-for-word against the source text.
          </p>
        </footer>
      </body>
    </html>
  );
}
