"use client";

import React, {
  useEffect, useState, useMemo, useCallback, Suspense,
} from "react";
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
  ArrowLeft, FileText, AlertTriangle, Calendar, MessageSquareQuote,
  ShieldAlert, Mail, Printer, Copy, Share2, Info,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface TranslatedPayload {
  summary: string[];
  traps: { why: string; action: string; question?: string }[];
  questions: string[];
  deadlines: { label: string }[];
  missing: { item: string; why: string }[];
}

type TabId = "risks" | "dates_costs" | "ask" | "document";
type SeverityFilter = "all" | "high" | "medium" | "low";

// ─── Main Results Component ────────────────────────────────────────────────────

function ResultsContent() {
  const [stage, setStage] = useState<PipelineStage>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [activeTab, setActiveTab] = useState<TabId>("risks");
  const [selectedClauseId, setSelectedClauseId] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");

  // Language & translation
  const [locale, setLocale] = useState<SupportedLocale>("en");
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationCache, setTranslationCache] = useState<Partial<Record<SupportedLocale, TranslatedPayload>>>({});
  const [emailModalOpen, setEmailModalOpen] = useState(false);

  // ── Analysis ──
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
      if (!res.ok) throw new Error(data.error?.message || "Failed to analyze document.");
      setResult(data);
      try { sessionStorage.setItem("clearsign_analysis", JSON.stringify(data)); } catch { /* ignore */ }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      clearTimeout(timer1); clearTimeout(timer2);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    async function initialize() {
      let rawText = "";
      try { rawText = sessionStorage.getItem("clearsign_raw_text") || ""; } catch { /* ignore */ }
      if (!rawText) {
        try {
          const res = await fetch("/samples/gym-membership.txt");
          if (!res.ok) throw new Error();
          rawText = await res.text();
        } catch {
          if (isMounted) { setError("No document provided. Please go back and upload or paste a contract."); setIsLoading(false); }
          return;
        }
      }
      if (isMounted && rawText) runAnalysis(rawText);
    }
    initialize();
    return () => { isMounted = false; };
  }, [runAnalysis]);

  // ── Translation ──
  const handleLocaleChange = useCallback(async (newLocale: SupportedLocale) => {
    setLocale(newLocale);
    if (newLocale === "en" || !result) return;
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
    } catch { /* silently fall back to English */ } finally {
      setIsTranslating(false);
    }
  }, [result, translationCache]);

  // ── Display data ──
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
      deadlines: result.deadlines.map((d, i) => ({ ...d, label: t?.deadlines[i]?.label ?? d.label })),
      missing: result.missing.map((m, i) => ({
        item: t?.missing[i]?.item ?? m.item,
        why: t?.missing[i]?.why ?? m.why,
      })),
    };
  }, [result, locale, translationCache]);

  const clauseSeverities = useMemo(() => {
    const map: Record<string, "high" | "medium" | "low"> = {};
    if (!result?.traps) return map;
    for (const trap of result.traps) {
      const current = map[trap.clauseId];
      if (trap.severity === "high") map[trap.clauseId] = "high";
      else if (trap.severity === "medium" && current !== "high") map[trap.clauseId] = "medium";
      else if (!current) map[trap.clauseId] = "low";
    }
    return map;
  }, [result]);

  const sortedTraps = useMemo(() => {
    if (!displayData?.traps) return [];
    const rank: Record<string, number> = { high: 3, medium: 2, low: 1 };
    return [...displayData.traps].sort((a, b) => rank[b.severity] - rank[a.severity]);
  }, [displayData]);

  const filteredTraps = useMemo(() => {
    if (severityFilter === "all") return sortedTraps;
    return sortedTraps.filter((t) => t.severity === severityFilter);
  }, [sortedTraps, severityFilter]);

  const trapCounts = useMemo(() => ({
    all:    sortedTraps.length,
    high:   sortedTraps.filter((t) => t.severity === "high").length,
    medium: sortedTraps.filter((t) => t.severity === "medium").length,
    low:    sortedTraps.filter((t) => t.severity === "low").length,
  }), [sortedTraps]);

  const handleShowInDocument = useCallback((clauseId: string) => {
    setSelectedClauseId(clauseId);
    setActiveTab("document");
  }, []);

  const handleCopyAll = useCallback(async () => {
    if (!displayData || !result) return;
    const text = [
      `ClearSign Analysis`,
      `Score: ${result.score}/100 — ${result.band.toUpperCase()} RISK`,
      "",
      ...displayData.summary.map((s) => `• ${s}`),
      "",
      "Reading aid, not legal advice.",
    ].join("\n");
    try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  }, [displayData, result]);

  const handleShare = useCallback(async () => {
    if (!displayData || !result) return;
    const text = displayData.summary.join(". ");
    if (navigator.share) {
      try { await navigator.share({ title: "ClearSign Analysis", text }); } catch { /* dismissed */ }
    } else {
      handleCopyAll();
    }
  }, [displayData, result, handleCopyAll]);

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <ProgressSteps currentStage={stage} />
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div
        className="max-w-md mx-auto my-12 p-6 rounded-2xl text-center space-y-4"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--sev-high)" }}
      >
        <div
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: "var(--sev-high-tint)" }}
        >
          <AlertTriangle className="h-6 w-6" style={{ color: "var(--sev-high)" }} strokeWidth={1.75} />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            Analysis Error
          </h3>
          <p className="text-xs" style={{ color: "var(--foreground-2)" }}>{error}</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition-colors"
          style={{ backgroundColor: "var(--primary)", color: "var(--primary-foreground)" }}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Try another document
        </Link>
      </div>
    );
  }

  if (!result || !displayData) return null;

  // ── Tab config ──
  const TABS: { id: TabId; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }>; label: string; count?: number }[] = [
    { id: "risks",      Icon: ShieldAlert,         label: "Risks",       count: sortedTraps.length },
    { id: "dates_costs", Icon: Calendar,            label: "Dates & Costs" },
    { id: "ask",         Icon: MessageSquareQuote,  label: "Ask" },
    { id: "document",    Icon: FileText,            label: "Document",    count: clauses.length },
  ];

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-16" aria-live="polite">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap no-print">
        {/* Left: back */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-colors"
          style={{
            border: "1px solid var(--border-strong)",
            color: "var(--foreground)",
            backgroundColor: "transparent",
            minHeight: "40px",
          }}
        >
          <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
          Analyze another
        </Link>

        {/* Right: actions + language + listen */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Icon actions */}
          <button
            type="button"
            onClick={handleCopyAll}
            aria-label="Copy summary"
            className="flex items-center justify-center rounded-xl transition-colors"
            style={{
              width: "40px", height: "40px",
              border: "1px solid var(--border-strong)",
              color: "var(--foreground-2)",
              backgroundColor: "transparent",
            }}
          >
            <Copy className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Share"
            className="flex items-center justify-center rounded-xl transition-colors"
            style={{
              width: "40px", height: "40px",
              border: "1px solid var(--border-strong)",
              color: "var(--foreground-2)",
              backgroundColor: "transparent",
            }}
          >
            <Share2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Print or Save as PDF"
            className="flex items-center justify-center rounded-xl transition-colors"
            style={{
              width: "40px", height: "40px",
              border: "1px solid var(--border-strong)",
              color: "var(--foreground-2)",
              backgroundColor: "transparent",
            }}
          >
            <Printer className="h-4 w-4" strokeWidth={1.75} />
          </button>

          <LanguageSwitch
            current={locale}
            onChange={handleLocaleChange}
            isTranslating={isTranslating}
          />
          <ReadAloud segments={displayData.summary} locale={locale} />
        </div>
      </div>

      {/* ── Fallback banner ── */}
      {result.engine === "rules-only" && (
        <div
          id="rules-fallback-banner"
          className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold"
          style={{
            border: "1px solid var(--primary-border)",
            backgroundColor: "var(--primary-tint)",
            color: "var(--primary)",
          }}
        >
          <AlertTriangle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span>AI analysis unavailable, showing rule-based results</span>
        </div>
      )}

      {/* ── Verdict card ── */}
      <VerdictCard
        score={result.score}
        band={result.band}
        summary={displayData.summary}
        docType={result.docType}
        removedUnverified={result.removedUnverified}
        clauseCount={clauses.length}
      />

      {/* ── Sticky tab bar ── */}
      <div
        className="sticky top-[64px] z-30 -mx-4 sm:-mx-6 px-4 sm:px-6 border-b no-print"
        style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
      >
        <div
          className="flex gap-0 overflow-x-auto"
          role="tablist"
          aria-label="Results sections"
          style={{ scrollbarWidth: "none" }}
        >
          {TABS.map(({ id, Icon, label, count }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tab-${id}`}
                aria-selected={isActive}
                aria-controls={`panel-${id}`}
                onClick={() => setActiveTab(id)}
                className="flex items-center gap-1.5 px-4 py-3.5 text-xs font-semibold transition-all shrink-0 border-b-2"
                style={{
                  color: isActive ? "var(--primary)" : "var(--foreground-2)",
                  borderBottomColor: isActive ? "var(--primary)" : "transparent",
                  minHeight: "48px",
                }}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
                <span className="hidden xs:inline sm:inline">{label}</span>
                {count !== undefined && (
                  <span
                    className="rounded-full px-1.5 py-0.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: isActive ? "var(--primary-tint)" : "var(--surface-2)",
                      color: isActive ? "var(--primary)" : "var(--muted)",
                    }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab: Risks ── */}
      {activeTab === "risks" && (
        <div id="panel-risks" role="tabpanel" aria-labelledby="tab-risks" className="space-y-5">

          {/* Filter chips */}
          {sortedTraps.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "high", "medium", "low"] as const).map((f) => {
                const isActive = severityFilter === f;
                const colorMap: Record<string, string> = {
                  high: "var(--sev-high)", medium: "var(--sev-med)", low: "var(--sev-low)", all: "var(--foreground-2)",
                };
                const tintMap: Record<string, string> = {
                  high: "var(--sev-high-tint)", medium: "var(--sev-med-tint)", low: "var(--sev-low-tint)", all: "var(--surface-2)",
                };
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setSeverityFilter(f)}
                    className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
                    style={{
                      backgroundColor: isActive ? tintMap[f] : "transparent",
                      color: isActive ? colorMap[f] : "var(--muted)",
                      border: isActive ? `1px solid ${colorMap[f]}` : "1px solid var(--border-strong)",
                      minHeight: "32px",
                    }}
                  >
                    {f === "all" ? `All (${trapCounts.all})` :
                     f === "high" ? `High (${trapCounts.high})` :
                     f === "medium" ? `Medium (${trapCounts.medium})` :
                     `Low (${trapCounts.low})`}
                  </button>
                );
              })}

              {sortedTraps.length > 0 && (
                <button
                  type="button"
                  onClick={() => setEmailModalOpen(true)}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                  style={{
                    border: "1px solid var(--border-strong)",
                    color: "var(--foreground-2)",
                    backgroundColor: "transparent",
                    minHeight: "36px",
                  }}
                >
                  <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Draft negotiation email
                </button>
              )}
            </div>
          )}

          {/* Trap cards */}
          {filteredTraps.length === 0 ? (
            <div
              className="p-8 text-center rounded-2xl text-xs"
              style={{
                backgroundColor: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--muted)",
              }}
            >
              {sortedTraps.length === 0
                ? "No high-risk terms identified by rules or AI."
                : `No ${severityFilter} risk findings.`}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTraps.map((trap, idx) => (
                <TrapCard
                  key={`${trap.clauseId}-${trap.category}-${idx}`}
                  trap={trap}
                  onShowInDocument={handleShowInDocument}
                />
              ))}
            </div>
          )}

          {/* Questions */}
          <QuestionsToAsk questions={displayData.questions} />

          {/* Missing protections */}
          {displayData.missing.length > 0 && (
            <div className="space-y-2">
              <h4
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: "var(--foreground-2)" }}
              >
                Missing Protections
              </h4>
              <div className="space-y-2">
                {displayData.missing.map((m, i) => (
                  <div
                    key={i}
                    className="rounded-xl p-3 space-y-1"
                    style={{
                      backgroundColor: "var(--sev-med-tint)",
                      border: "1px solid var(--sev-med)",
                    }}
                  >
                    <p
                      className="text-xs font-semibold flex items-center gap-1.5"
                      style={{ color: "var(--sev-med)" }}
                    >
                      <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
                      {m.item}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--foreground-2)" }}>{m.why}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Dates & Costs ── */}
      {activeTab === "dates_costs" && (
        <div id="panel-dates_costs" role="tabpanel" aria-labelledby="tab-dates_costs">
          <DatesCostsPanel result={result} />
        </div>
      )}

      {/* ── Tab: Ask ── */}
      {activeTab === "ask" && (
        <div id="panel-ask" role="tabpanel" aria-labelledby="tab-ask">
          <AskPanel clauses={clauses} result={result} onShowInDocument={handleShowInDocument} />
        </div>
      )}

      {/* ── Tab: Document ── */}
      {activeTab === "document" && (
        <div id="panel-document" role="tabpanel" aria-labelledby="tab-document" className="space-y-4">
          <DocumentViewer
            clauses={clauses}
            activeClauseId={selectedClauseId}
            clauseSeverities={clauseSeverities}
            onSelectClause={(id) => setSelectedClauseId(id)}
          />
        </div>
      )}

      {/* ── Draft Email Modal ── */}
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
          <div
            className="animate-spin rounded-full h-8 w-8 border-b-2"
            style={{ borderColor: "var(--primary)" }}
          />
        </div>
      }
    >
      <ResultsContent />
    </Suspense>
  );
}
