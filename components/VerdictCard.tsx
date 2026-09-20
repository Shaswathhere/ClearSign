"use client";

import React, { useState, useCallback } from "react";
import {
  AlertTriangle, CheckCircle, AlertOctagon, ShieldAlert, ListChecks,
  Copy, Share2, Check, ShieldCheck,
} from "lucide-react";
import { RiskBand } from "@/lib/score";

interface VerdictCardProps {
  score: number;
  band: RiskBand;
  summary: string[];
  docType?: string;
  removedUnverified?: number;
  clauseCount?: number;
}

/* ── Severity band config ── */
function getBandConfig(band: RiskBand) {
  switch (band) {
    case "low":
      return {
        Icon: CheckCircle,
        title: "LOW RISK",
        subtitle: "Looks fairly standard",
        badgeColor: "var(--sev-low)",
        badgeTint: "var(--sev-low-tint)",
        barColor: "var(--sev-low)",
      };
    case "moderate":
      return {
        Icon: AlertTriangle,
        title: "MODERATE RISK",
        subtitle: "Review before signing",
        badgeColor: "var(--sev-med)",
        badgeTint: "var(--sev-med-tint)",
        barColor: "var(--sev-med)",
      };
    case "high":
      return {
        Icon: ShieldAlert,
        title: "HIGH RISK",
        subtitle: "Negotiate or get advice first",
        badgeColor: "var(--sev-high)",
        badgeTint: "var(--sev-high-tint)",
        barColor: "var(--sev-high)",
      };
    case "severe":
    default:
      return {
        Icon: AlertOctagon,
        title: "SEVERE RISK",
        subtitle: "Serious concerns — get advice before signing",
        badgeColor: "var(--sev-severe)",
        badgeTint: "rgba(220,38,38,0.12)",
        barColor: "var(--sev-severe)",
      };
  }
}

export default function VerdictCard({
  score,
  band,
  summary,
  docType = "Contract",
  removedUnverified = 0,
  clauseCount = 0,
}: VerdictCardProps) {
  const [copied, setCopied] = useState(false);
  const config = getBandConfig(band);
  const formattedDocType = docType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const summaryText = [
    `ClearSign Analysis — ${formattedDocType}`,
    `Risk Score: ${score}/100 (${config.title})`,
    `${config.subtitle}`,
    "",
    ...summary.map((s) => `• ${s}`),
    "",
    "Reading aid, not legal advice. Powered by ClearSign.",
  ].join("\n");

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = summaryText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [summaryText]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `ClearSign: ${formattedDocType} Analysis`, text: summaryText });
      } catch { /* dismissed */ }
    } else {
      handleCopy();
    }
  }, [summaryText, formattedDocType, handleCopy]);

  const isSevere = band === "severe";

  return (
    <div
      className="rounded-2xl p-5 sm:p-7 space-y-5 border"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: isSevere ? "var(--sev-severe)" : "var(--border)",
      }}
    >
      {/* Top: band badge + doc type chip + score */}
      <div
        className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-5"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="space-y-2">
          {/* Band badge */}
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider"
              style={{
                backgroundColor: isSevere ? "var(--sev-severe)" : config.badgeTint,
                color: isSevere ? "var(--sev-severe-fg)" : config.badgeColor,
                border: `1px solid ${config.badgeColor}`,
              }}
            >
              <config.Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              {config.title}
            </span>
            {/* Doc type chip */}
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--foreground-2)",
                border: "1px solid var(--border)",
              }}
            >
              {formattedDocType}
              {clauseCount > 0 && ` · ${clauseCount} clauses`}
            </span>
          </div>
          <p className="text-sm font-semibold" style={{ color: "var(--foreground-2)" }}>
            {config.subtitle}
          </p>
        </div>

        {/* Big score */}
        <div
          className="flex flex-col items-end gap-2 self-start"
        >
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black tracking-tight" style={{ color: "var(--foreground)" }}>
              {score}
            </span>
            <span className="text-sm font-bold" style={{ color: "var(--muted)" }}>/ 100</span>
          </div>
          {/* Progress bar */}
          <div
            className="w-32 rounded-full overflow-hidden"
            style={{ height: "6px", backgroundColor: "var(--surface-2)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${score}%`,
                backgroundColor: config.barColor,
              }}
            />
          </div>
        </div>
      </div>

      {/* Key takeaways */}
      <div className="space-y-3">
        <h4
          className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
          style={{ color: "var(--muted)" }}
        >
          <ListChecks className="h-3.5 w-3.5" strokeWidth={1.75} />
          Key Takeaways
        </h4>
        <ul className="space-y-2">
          {summary.map((point, i) => (
            <li key={i} className="flex items-start gap-2 text-sm leading-relaxed">
              <span
                className="mt-2 h-1.5 w-1.5 rounded-full shrink-0"
                style={{ backgroundColor: "var(--primary)" }}
              />
              <span style={{ color: "var(--foreground)" }}>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t text-xs"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {removedUnverified > 0 ? (
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--foreground-2)",
                border: "1px solid var(--border)",
              }}
            >
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--sev-low)" }} strokeWidth={1.75} />
              <strong>{removedUnverified}</strong>&nbsp;unverified AI findings removed
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5" style={{ color: "var(--foreground-2)" }}>
              <ShieldCheck className="h-3.5 w-3.5" style={{ color: "var(--sev-low)" }} strokeWidth={1.75} />
              Every quote verified against your document
            </span>
          )}

          <button
            type="button"
            id="verdict-copy-btn"
            onClick={handleCopy}
            aria-label="Copy summary"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors"
            style={{
              color: "var(--foreground-2)",
              border: "1px solid var(--border-strong)",
              backgroundColor: "transparent",
            }}
          >
            {copied ? <Check className="h-3.5 w-3.5" style={{ color: "var(--sev-low)" }} strokeWidth={1.75} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />}
            {copied ? "Copied!" : "Copy"}
          </button>

          <button
            type="button"
            id="verdict-share-btn"
            onClick={handleShare}
            aria-label="Share summary"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 transition-colors"
            style={{
              color: "var(--foreground-2)",
              border: "1px solid var(--border-strong)",
              backgroundColor: "transparent",
            }}
          >
            <Share2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            Share
          </button>
        </div>

        <span className="italic" style={{ color: "var(--muted)" }}>
          Reading aid, not legal advice
        </span>
      </div>
    </div>
  );
}
