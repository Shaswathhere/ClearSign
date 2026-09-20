"use client";

import React, { useEffect, useRef } from "react";
import { Clause } from "@/lib/segment";
import { Severity } from "@/lib/schema";
import { z } from "zod";
import { ShieldAlert, AlertTriangle, Info } from "lucide-react";

type SeverityType = z.infer<typeof Severity>;

interface DocumentViewerProps {
  clauses: Clause[];
  activeClauseId?: string | null;
  clauseSeverities?: Record<string, SeverityType>;
  onSelectClause?: (clauseId: string) => void;
}

function getSeverityStyle(severity: SeverityType | undefined) {
  switch (severity) {
    case "high":
      return {
        bg: "var(--sev-high-tint)",
        border: "var(--sev-high)",
        color: "var(--sev-high)",
        label: "High risk",
        Icon: ShieldAlert,
      };
    case "medium":
      return {
        bg: "var(--sev-med-tint)",
        border: "var(--sev-med)",
        color: "var(--sev-med)",
        label: "Medium risk",
        Icon: AlertTriangle,
      };
    case "low":
      return {
        bg: "var(--sev-low-tint)",
        border: "var(--sev-low)",
        color: "var(--sev-low)",
        label: "Low risk",
        Icon: Info,
      };
    default:
      return null;
  }
}

export default function DocumentViewer({
  clauses,
  activeClauseId,
  clauseSeverities = {},
  onSelectClause,
}: DocumentViewerProps) {
  const clauseRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (activeClauseId && clauseRefs.current[activeClauseId]) {
      clauseRefs.current[activeClauseId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      // Trigger pulse
      const el = clauseRefs.current[activeClauseId];
      if (el) {
        el.classList.remove("clause-active-pulse");
        void el.offsetWidth; // reflow
        el.classList.add("clause-active-pulse");
      }
    }
  }, [activeClauseId]);

  if (!clauses || clauses.length === 0) {
    return (
      <div
        className="p-8 text-center rounded-2xl"
        style={{
          color: "var(--muted)",
          backgroundColor: "var(--surface)",
          border: "1px dashed var(--border-strong)",
        }}
      >
        No document text available.
      </div>
    );
  }

  return (
    <div
      className="font-mono text-sm leading-relaxed max-h-[70vh] overflow-y-auto rounded-2xl border p-4 sm:p-6"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Legend */}
      <div
        className="flex items-center justify-between pb-3 mb-3 border-b text-xs font-sans"
        style={{ borderColor: "var(--border)" }}
      >
        <span
          className="font-semibold uppercase tracking-wider"
          style={{ color: "var(--foreground-2)" }}
        >
          Source document ({clauses.length} clauses)
        </span>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--sev-high)" }}>
            <ShieldAlert className="h-3 w-3" strokeWidth={1.75} /> High
          </span>
          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--sev-med)" }}>
            <AlertTriangle className="h-3 w-3" strokeWidth={1.75} /> Medium
          </span>
          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--sev-low)" }}>
            <Info className="h-3 w-3" strokeWidth={1.75} /> Low
          </span>
        </div>
      </div>

      <div className="divide-y" style={{ borderColor: "var(--border)" }}>
        {clauses.map((clause) => {
          const severity = clauseSeverities[clause.id] as SeverityType | undefined;
          const sevStyle = getSeverityStyle(severity);
          const isActive = activeClauseId === clause.id;

          return (
            <div
              key={clause.id}
              ref={(el) => { clauseRefs.current[clause.id] = el; }}
              id={`clause-${clause.id}`}
              onClick={() => onSelectClause?.(clause.id)}
              className="p-3 transition-all duration-150 cursor-pointer rounded-lg"
              style={{
                backgroundColor: isActive
                  ? "var(--primary-tint)"
                  : sevStyle
                  ? sevStyle.bg
                  : "transparent",
                borderLeft: sevStyle
                  ? `3px solid ${sevStyle.border}`
                  : "3px solid transparent",
                outline: isActive ? "2px solid var(--primary)" : "none",
                outlineOffset: "1px",
              }}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5 font-sans">
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider font-mono"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    color: "var(--muted)",
                    border: "1px solid var(--border-strong)",
                  }}
                >
                  [{clause.id}]
                </span>
                {sevStyle && (
                  <span
                    className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: sevStyle.bg,
                      color: sevStyle.color,
                    }}
                  >
                    <sevStyle.Icon className="h-3 w-3" strokeWidth={1.75} />
                    {sevStyle.label}
                  </span>
                )}
              </div>
              <p
                className="whitespace-pre-wrap break-words leading-relaxed text-xs"
                style={{ color: "var(--foreground-2)" }}
              >
                {clause.text.trim()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
