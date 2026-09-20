"use client";

import React, { useEffect, useRef } from "react";
import { Clause } from "@/lib/segment";
import { Severity } from "@/lib/schema";
import { z } from "zod";

type SeverityType = z.infer<typeof Severity>;

interface DocumentViewerProps {
  clauses: Clause[];
  activeClauseId?: string | null;
  clauseSeverities?: Record<string, SeverityType>;
  onSelectClause?: (clauseId: string) => void;
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
    }
  }, [activeClauseId]);

  if (!clauses || clauses.length === 0) {
    return (
      <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
        No document text available.
      </div>
    );
  }

  return (
    <div className="space-y-3 font-mono text-sm leading-relaxed max-h-[70vh] overflow-y-auto pr-2 rounded-xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs font-sans text-slate-500">
        <span className="font-semibold uppercase tracking-wider text-slate-600">
          Source Document ({clauses.length} clauses)
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-[11px] text-rose-700">
            <span className="h-2 w-2 rounded-full bg-rose-500" /> High
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Medium
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Low
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-100">
        {clauses.map((clause) => {
          const severity = clauseSeverities[clause.id];
          const isActive = activeClauseId === clause.id;

          let highlightClasses = "bg-transparent text-slate-800 border-l-2 border-transparent";
          if (severity === "high") {
            highlightClasses = "bg-rose-50/80 text-rose-950 border-l-4 border-rose-500 font-medium";
          } else if (severity === "medium") {
            highlightClasses = "bg-amber-50/80 text-amber-950 border-l-4 border-amber-500";
          } else if (severity === "low") {
            highlightClasses = "bg-emerald-50/70 text-emerald-950 border-l-4 border-emerald-500";
          }

          if (isActive) {
            highlightClasses += " ring-2 ring-teal-600 ring-offset-1 rounded-md shadow-sm";
          }

          return (
            <div
              key={clause.id}
              ref={(el) => {
                clauseRefs.current[clause.id] = el;
              }}
              id={`clause-${clause.id}`}
              onClick={() => onSelectClause?.(clause.id)}
              className={`p-3 transition-all duration-150 cursor-pointer hover:bg-slate-50/80 ${highlightClasses}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1.5 font-sans">
                <span className="inline-flex items-center rounded bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 tracking-wider">
                  [{clause.id}]
                </span>
                {severity && (
                  <span
                    className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      severity === "high"
                        ? "bg-rose-100 text-rose-800"
                        : severity === "medium"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {severity} Risk
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap break-words leading-relaxed">
                {clause.text.trim()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
