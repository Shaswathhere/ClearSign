"use client";

import React, { useState } from "react";
import { VerifiedTrap } from "@/lib/schema";
import { ExternalLink, AlertTriangle, Info, ShieldAlert, AlertOctagon, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

interface TrapCardProps {
  trap: VerifiedTrap;
  onShowInDocument?: (clauseId: string) => void;
}

/* Severity config (colours ONLY on severity elements) */
function getSeverityConfig(severity: string) {
  switch (severity) {
    case "high":
      return {
        label: "High risk",
        Icon: ShieldAlert,
        color: "var(--sev-high)",
        tint: "var(--sev-high-tint)",
        border: "var(--sev-high)",
      };
    case "medium":
      return {
        label: "Medium risk",
        Icon: AlertTriangle,
        color: "var(--sev-med)",
        tint: "var(--sev-med-tint)",
        border: "var(--sev-med)",
      };
    case "low":
    default:
      return {
        label: "Low risk",
        Icon: Info,
        color: "var(--sev-low)",
        tint: "var(--sev-low-tint)",
        border: "var(--sev-low)",
      };
  }
}

/* Human-readable category formatter */
function formatCategory(raw: string): string {
  return raw
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const QUOTE_CLAMP_LINES = 4;

export default function TrapCard({ trap, onShowInDocument }: TrapCardProps) {
  const [quoteExpanded, setQuoteExpanded] = useState(false);
  const cfg = getSeverityConfig(trap.severity);

  const isLongQuote = trap.quote.length > 200;

  return (
    <div
      className="rounded-2xl border overflow-hidden transition-all"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        borderLeft: `3px solid ${cfg.border}`,
      }}
    >
      <div className="p-5 space-y-4">
        {/* Header: severity badge + category */}
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <span
            className="font-bold text-sm leading-tight"
            style={{ color: "var(--foreground)" }}
          >
            {formatCategory(trap.category)}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: cfg.tint,
                color: cfg.color,
                border: `1px solid ${cfg.color}`,
              }}
            >
              <cfg.Icon className="h-3 w-3" strokeWidth={1.75} />
              {cfg.label}
            </span>
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold font-mono"
              style={{
                backgroundColor: "var(--surface-2)",
                color: "var(--muted)",
                border: "1px solid var(--border-strong)",
              }}
            >
              {trap.clauseId}
            </span>
          </div>
        </div>

        {/* Quoted clause */}
        <blockquote
          className="rounded-xl p-3.5 text-xs leading-relaxed italic"
          style={{
            backgroundColor: "var(--surface-2)",
            borderLeft: `3px solid var(--border-strong)`,
            color: "var(--foreground-2)",
          }}
        >
          <p
            style={
              !quoteExpanded && isLongQuote
                ? {
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: QUOTE_CLAMP_LINES,
                  }
                : {}
            }
          >
            &ldquo;{trap.quote}&rdquo;
          </p>
          {isLongQuote && (
            <button
              type="button"
              onClick={() => setQuoteExpanded(!quoteExpanded)}
              className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold transition-colors"
              style={{ color: "var(--primary)" }}
            >
              {quoteExpanded ? (
                <><ChevronUp className="h-3 w-3" strokeWidth={2} /> Show less</>
              ) : (
                <><ChevronDown className="h-3 w-3" strokeWidth={2} /> Show more</>
              )}
            </button>
          )}
        </blockquote>

        {/* Why + What to do */}
        <div className="space-y-3 text-xs">
          <div className="space-y-0.5">
            <span
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--muted)" }}
            >
              <AlertTriangle className="h-3 w-3" strokeWidth={1.75} />
              Why it matters
            </span>
            <p className="leading-relaxed" style={{ color: "var(--foreground-2)" }}>
              {trap.why}
            </p>
          </div>
          <div className="space-y-0.5">
            <span
              className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider"
              style={{ color: "var(--primary)" }}
            >
              <Lightbulb className="h-3 w-3" strokeWidth={1.75} />
              What to do
            </span>
            <p className="leading-relaxed font-medium" style={{ color: "var(--foreground)" }}>
              {trap.action}
            </p>
          </div>
        </div>

        {/* Show in document */}
        <div
          className="pt-3 border-t flex items-center justify-end"
          style={{ borderColor: "var(--border)" }}
        >
          <button
            type="button"
            onClick={() => onShowInDocument?.(trap.clauseId)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
            style={{ color: "var(--primary)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary-tint)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
            }}
          >
            Show in document [{trap.clauseId}]
            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    </div>
  );
}
