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
import DatesCostsPanel from "@/components/DatesCostsPanel";
import AskPanel from "@/components/AskPanel";
import LanguageSwitch, { SupportedLocale } from "@/components/LanguageSwitch";
import ReadAloud from "@/components/ReadAloud";
import DraftEmailModal from "@/components/DraftEmailModal";
import {
  ArrowLeft, FileText, AlertTriangle, Calendar, MessageSquareQuote, ShieldAlert, Mail, Printer,
} from "lucide-react";

// ─── Translation types ─────────────────────────────────────────────────────────

interface TranslatedPayload {
  summary: string[];
  traps: { why: string; action: string; question?: string }[];
  questions: string[];
  deadlines: { label: string }[];
  missing: { item: string; why: string }[];
}

// ─── Main Results Component ────────────────────────────────────────────────────

function ResultsContent() {
  const [stage, setStage] = useState<PipelineStage>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [activeTab, setActiveTab] = useState<"risks" | "dates_costs" | "ask" | "document">("risks");
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);

  // Language & translation state
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationCache, setTranslationCache] = useState<Partial<Record<SupportedLocale, TranslatedPayload>>>({});
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  const runAnalysis = useCallback(async (text: string) => {
    setIsLoading(true);
    setError(null);
    setStage(1);

    const segmented = segmentDocument(text);
    setClauses(segmented);

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

  // ─── Translation ────────────────────────────────────────────────────────────

  const handleLocaleChange = useCallback(async (newLocale: SupportedLocale) => {
    setLocale(newLocale);
    if (newLocale === "en" || !result) return;

    // Use cache if available
    if (translationCache[newLocale]) return;

    setIsTranslating(true);
    try {
      const payload = {
        summary: result.summary,
        traps: result.traps.map((t) => ({ why: t.why, action: t.action, question: t.question })),
        questions: result.questions,
        deadlines: result.deadlines.map((d) => ({ label: d.label })),
        missing: result.missing,
      };

      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: newLocale, payload }),
      });

      if (res.ok) {
        const translated: TranslatedPayload = await res.json();
        setTranslationCache((prev) => ({ ...prev, [newLocale]: translated }));
      }
    } catch {
      // Silently fail — fall back to English
    } finally {
      setIsTranslating(false);
    }
  }, [result, translationCache]);

  // ─── Derived display data (translated if available) ─────────────────────────

  const displayData = useMemo(() => {
    if (!result) return null;
    const t = locale !== "en" ? translationCache[locale] : null;

    return {
      summary: t?.summary ?? result.summary,
      traps: result.traps.map((trap, i) => ({
        ...trap,
        why: t?.traps[i]?.why ?? trap.why,
        action: t?.traps[i]?.action ?? trap.action,
        question: t?.traps[i]?.question ?? trap.question,
      })),
      questions: t?.questions ?? result.questions,
      deadlines: result.deadlines.map((d, i) => ({
        ...d,
        label: t?.deadlines[i]?.label ?? d.label,
      })),
      missing: result.missing.map((m, i) => ({
        item: t?.missing[i]?.item ?? m.item,
        why: t?.missing[i]?.why ?? m.why,
      })),
    };
  }, [result, locale, translationCache]);

  // ─── Clause severity map ────────────────────────────────────────────────────

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

  const sortedTraps = useMemo(() => {
    if (!displayData?.traps) return [];
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return [...displayData.traps].sort((a, b) => rank[b.severity] - rank[a.severity]);
  }, [displayData]);

  const handleShowInDocument = useCallback((clauseId: string) => {
    setSelectedClauseId(clauseId);
    setActiveTab("document");
  }, []);

  // ─── Render: loading ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <ProgressSteps currentStage={stage} />
      </div>
    );
  }

  // ─── Render: error ──────────────────────────────────────────────────────────

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
          className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Try another document
        </Link>
      </div>
    );
  }

  if (!result || !displayData) return null;

  // ─── Render: results ────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap no-print">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-700 transition-colors py-2"
          >
            <ArrowLeft className="h-4 w-4" /> Analyze another contract
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-700 transition-colors py-2 cursor-pointer"
            title="Print or Save as PDF"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            Print / PDF
          </button>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ReadAloud segments={displayData.summary} locale={locale} />
          <LanguageSwitch
            current={locale}
            onChange={handleLocaleChange}
            isTranslating={isTranslating}
          />
        </div>
      </div>

      {/* Verdict card */}
      <VerdictCard
        score={result.score}
        band={result.band}
        summary={displayData.summary}
        docType={result.docType}
        removedUnverified={result.removedUnverified}
        clauseCount={clauses.length}
      />

      {/* Tabs */}
      <div
        className="flex border-b border-slate-200 gap-1 sm:gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Results tabs"
      >
        {(
          [
            { id: "risks", icon: <ShieldAlert className="h-4 w-4" />, label: `Risks (${sortedTraps.length})` },
            { id: "dates_costs", icon: <Calendar className="h-4 w-4" />, label: "Dates & Costs" },
            { id: "ask", icon: <MessageSquareQuote className="h-4 w-4" />, label: "Ask Document" },
            { id: "document", icon: <FileText className="h-4 w-4" />, label: `Document (${clauses.length})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all shrink-0 min-h-[48px] ${
              activeTab === tab.id
                ? "bg-indigo-700 text-white shadow-xs"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Risks */}
      {activeTab === "risks" && (
        <div
          id="panel-risks"
          role="tabpanel"
          aria-labelledby="tab-risks"
          className="space-y-6"
        >
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                Identified Contract Traps ({sortedTraps.length})
              </h3>
              {sortedTraps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-semibold shadow-xs transition-colors min-h-[36px]"
                >
                  <Mail className="h-3.5 w-3.5 text-indigo-700" />
                  Draft Negotiation Email
                </button>
              )}
            </div>
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
          <QuestionsToAsk questions={displayData.questions} />

          {/* Missing protections (P1) */}
          {displayData.missing.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Missing Protections
              </h4>
              <div className="space-y-2">
                {displayData.missing.map((m, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1">
                    <p className="text-xs font-semibold text-amber-800">⚠ {m.item}</p>
                    <p className="text-[11px] text-amber-700">{m.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab: Dates & Costs */}
      {activeTab === "dates_costs" && (
        <div
          id="panel-dates_costs"
          role="tabpanel"
          aria-labelledby="tab-dates_costs"
        >
          <DatesCostsPanel result={result} />
        </div>
      )}

      {/* Tab: Ask Document */}
      {activeTab === "ask" && (
        <div
          id="panel-ask"
          role="tabpanel"
          aria-labelledby="tab-ask"
        >
          <AskPanel
            clauses={clauses}
            result={result}
            onShowInDocument={handleShowInDocument}
          />
        </div>
      )}

      {/* Tab: Document */}
      {activeTab === "document" && (
        <div
          id="panel-document"
          role="tabpanel"
          aria-labelledby="tab-document"
          className="space-y-4"
        >
          <DocumentViewer
            clauses={clauses}
            activeClauseId={selectedClauseId}
            clauseSeverities={clauseSeverities}
            onSelectClause={(id) => setSelectedClauseId(id)}
          />
        </div>
      )}

      {/* Draft Negotiation Email Modal */}
      <DraftEmailModal
        traps={sortedTraps}
        docType={result.docType}
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
      />
    </div>
  );
}

export default function ResultsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[60vh] flex items-center justify-center p-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-700" />
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
