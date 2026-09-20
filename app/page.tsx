"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import InputPanel from "@/components/InputPanel";
import DocumentViewer from "@/components/DocumentViewer";
import { segmentDocument, Clause } from "@/lib/segment";
import { Shield, Sparkles, FileText, CheckCircle2 } from "lucide-react";

export default function Home() {
  const router = useRouter();
  const [analyzing, setAnalyzing] = useState(false);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [activeClauseId, setActiveClauseId] = useState<string | null>(null);

  const handleAnalyze = async (text: string) => {
    setAnalyzing(true);
    // Segment clauses client-side
    const segmented = segmentDocument(text);
    setClauses(segmented);

    // Store in sessionStorage so results page can access it
    try {
      sessionStorage.setItem("clearsign_raw_text", text);
      sessionStorage.setItem("clearsign_clauses", JSON.stringify(segmented));
    } catch {
      // Ignore sessionStorage exceptions
    }

    // Redirect to results flow
    router.push("/results?source=input");
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 py-2 sm:py-6">
      {/* Hero Section */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 border border-teal-200">
          <Sparkles className="h-3.5 w-3.5 text-teal-600" />
          Understand before you sign or agree
        </div>
        <h1 className="text-2xl sm:text-4xl font-extrabold text-slate-900 tracking-tight leading-tight">
          Never agree to a contract you haven&apos;t fully understood.
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto leading-relaxed">
          ClearSign finds hidden traps, auto-renewals, and unfair penalties. Every finding is verified word-for-word against the source document.
        </p>
      </div>

      {/* Input Component */}
      <InputPanel onAnalyze={handleAnalyze} isLoading={analyzing} />

      {/* Privacy Guarantee Card */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
          <Shield className="h-4 w-4 text-teal-700" />
          <span>Our Privacy & Verification Guarantees</span>
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

      {/* Preview if clauses exist */}
      {clauses.length > 0 && (
        <div className="space-y-3 pt-4">
          <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <FileText className="h-4 w-4 text-teal-700" />
            Document Clauses Preview
          </h2>
          <DocumentViewer
            clauses={clauses}
            activeClauseId={activeClauseId}
            onSelectClause={(id) => setActiveClauseId(id)}
          />
        </div>
      )}
    </div>
  );
}
