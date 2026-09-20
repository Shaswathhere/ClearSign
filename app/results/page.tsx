"use client";

import React, { useEffect, useState, useMemo, useCallback, Suspense } from "react";
import Link from "next/link";
import { AnalyzeResponse } from "@/lib/schema";
import { Clause, segmentDocument } from "@/lib/segment";
import VerdictCard from "@/components/VerdictCard";
import TrapCard from "@/components/TrapCard";
import DocumentViewer from "@/components/DocumentViewer";
import ProgressSteps, { PipelineStage } from "@/components/ProgressSteps";
import QuestionsToAsk from "@/components/QuestionsToAsk";
import { ArrowLeft, FileText, AlertTriangle, Calendar, MessageSquareQuote, ShieldAlert } from "lucide-react";

function ResultsContent() {
  const [stage, setStage] = useState<PipelineStage>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [activeTab, setActiveTab] = useState<"risks" | "dates_costs" | "ask" | "document">("risks");
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);

  const runAnalysis = useCallback(async (text: string) => {
    setIsLoading(true);
    setError(null);
    setStage(1);

    const segmented = segmentDocument(text);
    setClauses(segmented);

    // Staged progress timers to mirror actual pipeline
    const timer1 = setTimeout(() => setStage(2), 600);
    const timer2 = setTimeout(() => setStage(3), 1400);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, clauses: segmented }),
      });

      setStage(4);

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to analyze document.");
      }

      setResult(data);
      // Store in session storage for dates and calculators
      try {
        sessionStorage.setItem("clearsign_analysis", JSON.stringify(data));
      } catch {
        // Ignore
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Analysis failed.";
      setError(msg);
    } finally {
      clearTimeout(timer1);
      clearTimeout(timer2);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      let rawText = "";
      try {
        rawText = sessionStorage.getItem("clearsign_raw_text") || "";
      } catch {
        // Ignore
      }

      if (!rawText) {
        try {
          const res = await fetch("/samples/gym-membership.txt");
          if (!res.ok) throw new Error();
          rawText = await res.text();
        } catch {
          if (isMounted) {
            setError("No document provided. Please go back to the home page to upload or paste a contract.");
            setIsLoading(false);
          }
          return;
        }
      }

      if (isMounted && rawText) {
        runAnalysis(rawText);
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, [runAnalysis]);

  // Severity map for document viewer highlights
  const clauseSeverities = useMemo(() => {
    const map: Record<string, "high" | "medium" | "low"> = {};
    if (!result?.traps) return map;

    for (const trap of result.traps) {
      const current = map[trap.clauseId];
      if (trap.severity === "high") {
        map[trap.clauseId] = "high";
      } else if (trap.severity === "medium" && current !== "high") {
        map[trap.clauseId] = "medium";
      } else if (!current) {
        map[trap.clauseId] = "low";
      }
    }
    return map;
  }, [result]);

  // Traps sorted by severity: high first, then medium, then low
  const sortedTraps = useMemo(() => {
    if (!result?.traps) return [];
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return [...result.traps].sort((a, b) => rank[b.severity] - rank[a.severity]);
  }, [result]);

  // Jump from TrapCard to Document Tab
  const handleShowInDocument = (clauseId: string) => {
    setSelectedClauseId(clauseId);
    setActiveTab("document");
  };

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <ProgressSteps currentStage={stage} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto my-12 bg-white p-6 rounded-2xl border border-rose-200 shadow-sm text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-slate-900">Analysis Error</h3>
          <p className="text-xs text-slate-600">{error}</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-teal-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Try another document
        </Link>
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Bar with back link */}
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-teal-700 transition-colors py-2"
        >
          <ArrowLeft className="h-4 w-4" /> Analyze another contract
        </Link>
        <span className="text-xs font-semibold text-slate-500">
          {sortedTraps.length} verified findings
        </span>
      </div>

      {/* Primary Verdict Card */}
      <VerdictCard
        score={result.score}
        band={result.band}
        summary={result.summary}
        docType={result.docType}
        removedUnverified={result.removedUnverified}
        clauseCount={clauses.length}
      />

      {/* 4 Main Tabs */}
      <div className="flex border-b border-slate-200 gap-1 sm:gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("risks")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all shrink-0 min-h-[48px] ${
            activeTab === "risks"
              ? "bg-teal-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <ShieldAlert className="h-4 w-4" />
          Risks ({sortedTraps.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("dates_costs")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all shrink-0 min-h-[48px] ${
            activeTab === "dates_costs"
              ? "bg-teal-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Calendar className="h-4 w-4" />
          Dates & Costs
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("ask")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all shrink-0 min-h-[48px] ${
            activeTab === "ask"
              ? "bg-teal-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <MessageSquareQuote className="h-4 w-4" />
          Ask Document
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("document")}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all shrink-0 min-h-[48px] ${
            activeTab === "document"
              ? "bg-teal-700 text-white shadow-xs"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <FileText className="h-4 w-4" />
          Document ({clauses.length})
        </button>
      </div>

      {/* Tab 1: Risks Tab */}
      {activeTab === "risks" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Identified Contract Traps ({sortedTraps.length})
            </h3>
            {sortedTraps.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
                No high-risk terms identified by rules or AI.
              </div>
            ) : (
              <div className="space-y-4">
                {sortedTraps.map((trap, idx) => (
                  <TrapCard
                    key={`${trap.clauseId}-${trap.category}-${idx}`}
                    trap={trap}
                    onShowInDocument={handleShowInDocument}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Questions to Ask */}
          <QuestionsToAsk questions={result.questions} />
        </div>
      )}

      {/* Tab 2: Dates & Costs Tab (Pre-wired for Phase 4) */}
      {activeTab === "dates_costs" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4 text-center">
          <Calendar className="h-10 w-10 text-teal-700 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Dates & Financial Calculator</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Deterministic deadline resolution to .ics calendar files and loan/rental cost engine.
          </p>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-500 text-left max-w-md mx-auto space-y-2">
            <p><strong>Extracted Deadlines:</strong> {result.deadlines.length}</p>
            <p><strong>Loan Terms:</strong> {result.terms.loan ? `${result.terms.loan.annualRatePct}% annual rate` : "None"}</p>
            <p><strong>Rental Terms:</strong> {result.terms.rental ? `₹${result.terms.rental.monthlyRent}/mo` : "None"}</p>
            <p><strong>Subscription Terms:</strong> {result.terms.subscription ? `₹${result.terms.subscription.price}` : "None"}</p>
          </div>
        </div>
      )}

      {/* Tab 3: Ask Document Tab (Pre-wired for Phase 6) */}
      {activeTab === "ask" && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 space-y-4 text-center">
          <MessageSquareQuote className="h-10 w-10 text-teal-700 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">Ask this Document</h3>
          <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
            Chat with this contract grounded strictly in the source clauses with verified [C#] citations.
          </p>
        </div>
      )}

      {/* Tab 4: Source Document Viewer */}
      {activeTab === "document" && (
        <div className="space-y-4">
          <DocumentViewer
            clauses={clauses}
            activeClauseId={selectedClauseId}
            clauseSeverities={clauseSeverities}
            onSelectClause={(id) => setSelectedClauseId(id)}
          />
        </div>
      )}
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-700" />
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
