"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import InputPanel from "@/components/InputPanel";
import { segmentDocument } from "@/lib/segment";
import { Shield, Sparkles, CheckCircle2, Loader2 } from "lucide-react";

const SAMPLES = [
  { key: "gym-membership", label: "🏋 Gym Membership", file: "/samples/gym-membership.txt" },
  { key: "rental-agreement", label: "🏠 Rental Agreement", file: "/samples/rental-agreement.txt" },
  { key: "personal-loan", label: "💳 Personal Loan", file: "/samples/personal-loan.txt" },
];

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

  const handleSample = async (sample: (typeof SAMPLES)[number]) => {
    setLoadingSample(sample.key);
    try {
      const res = await fetch(sample.file);
      if (!res.ok) throw new Error(`Failed to load ${sample.label}`);
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
    <div className="max-w-3xl mx-auto space-y-8 py-2 sm:py-6">
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 border border-indigo-200">
          <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
          Understand before you sign or agree
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Never agree to a contract you haven&apos;t fully understood.
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
          ClearSign finds hidden traps, auto-renewals, and unfair penalties. Every finding is verified
          word-for-word against the source document.
        </p>
      </div>

      {/* Try a Sample chips */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center">
          Try a sample contract
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {SAMPLES.map((s) => (
            <button
              key={s.key}
              id={`sample-btn-${s.key}`}
              type="button"
              onClick={() => handleSample(s)}
              disabled={!!loadingSample || analyzing}
              className="flex items-center gap-2 rounded-xl border border-indigo-200 bg-white text-indigo-700 text-xs font-semibold px-4 py-2.5 hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {loadingSample === s.key ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3 text-xs text-slate-400">
        <div className="flex-1 border-t border-slate-200" />
        <span className="font-medium">or paste / upload your own</span>
        <div className="flex-1 border-t border-slate-200" />
      </div>

      {/* Input Component */}
      <InputPanel onAnalyze={handleAnalyze} isLoading={analyzing || !!loadingSample} />

      {/* Privacy Guarantee Card */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Shield className="h-4 w-4 text-indigo-700" />
          <span>Our Privacy &amp; Verification Guarantees</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Zero Document Storage:</strong> No database, no user accounts, and no persistent logs.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Client-Side PDF Parsing:</strong> Your PDF file stays in your browser memory and is never uploaded.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>100% Quote Verified:</strong> Unverified AI statements are discarded. No hallucinations shown.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong>Deterministic Arithmetic:</strong> All loan EMIs and penalty calculations are computed with tested code.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
