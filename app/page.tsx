"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import InputPanel from "@/components/InputPanel";
import { segmentDocument } from "@/lib/segment";
import { ShieldCheck, FileCheck, Globe } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  const handleAnalyze = async (text: string) => {
    setAnalyzing(true);
    const segmented = segmentDocument(text);
    try {
      sessionStorage.setItem("clearsign_raw_text", text);
      sessionStorage.setItem("clearsign_clauses", JSON.stringify(segmented));
    } catch {
      // Ignore sessionStorage exceptions
    }
    router.push("/results?source=input");
  };

  const handleSample = async (key: string, file: string) => {
    setLoadingSample(key);
    try {
      const res = await fetch(file);
      if (!res.ok) throw new Error(`Failed to load sample`);
      const text = await res.text();
      const segmented = segmentDocument(text);
      try {
        sessionStorage.setItem("clearsign_raw_text", text);
        sessionStorage.setItem("clearsign_clauses", JSON.stringify(segmented));
      } catch {
        // Ignore
      }
      router.push("/results?source=sample");
    } catch {
      setLoadingSample(null);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* ── Hero ── */}
      <div className="text-center space-y-4 pt-4 sm:pt-8">
        <p
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "var(--primary)" }}
        >
          Understand before you agree
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
          Know exactly what<br />you&apos;re signing.
        </h1>
        <p
          className="text-sm sm:text-base leading-relaxed max-w-md mx-auto"
          style={{ color: "var(--foreground-2)" }}
        >
          Paste or upload any contract. ClearSign flags the hidden traps,
          quotes them word for word, and explains them in your language.
        </p>
      </div>

      {/* ── Input Card ── */}
      <InputPanel
        onAnalyze={handleAnalyze}
        onSample={handleSample}
        isLoading={analyzing || !!loadingSample}
        loadingSampleKey={loadingSample}
      />

      {/* ── Trust row ── */}
      <div
        className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-xs pt-2"
        style={{ color: "var(--foreground-2)" }}
      >
        <span className="flex items-center gap-1.5">
          <FileCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Every quote checked against your document
        </span>
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Nothing stored
        </span>
        <span className="flex items-center gap-1.5">
          <Globe className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          English, Hindi, Tamil and more
        </span>
      </div>
    </div>
  );
}
