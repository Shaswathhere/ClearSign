"use client";

import React from "react";
import { VerifiedTrap } from "@/lib/schema";
import { ExternalLink, AlertTriangle, Info, ShieldAlert } from "lucide-react";

interface TrapCardProps {
  trap: VerifiedTrap;
  onShowInDocument?: (clauseId: string) => void;
}

export default function TrapCard({ trap, onShowInDocument }: TrapCardProps) {
  const getSeverityBadge = () => {
    switch (trap.severity) {
      case "high":
        return {
          label: "HIGH RISK",
          icon: <ShieldAlert className="h-3.5 w-3.5 text-rose-700" />,
          classes: "bg-rose-100 text-rose-800 border-rose-200",
        };
      case "medium":
        return {
          label: "MEDIUM RISK",
          icon: <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />,
          classes: "bg-amber-100 text-amber-800 border-amber-200",
        };
      case "low":
      default:
        return {
          label: "LOW RISK",
          icon: <Info className="h-3.5 w-3.5 text-emerald-700" />,
          classes: "bg-emerald-100 text-emerald-800 border-emerald-200",
        };
    }
  };

  const badge = getSeverityBadge();
  const formattedCategory = trap.category
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4 hover:border-slate-300 transition-all">
      {/* Header: Category & Severity */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="font-bold text-slate-900 text-sm">{formattedCategory}</span>
        <div className="flex items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider border ${badge.classes}`}
          >
            {badge.icon}
            {badge.label}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 font-mono">
            [{trap.clauseId}]
          </span>
        </div>
      </div>

      {/* Quoted Clause */}
      <blockquote className="rounded-xl border-l-4 border-slate-300 bg-slate-50/80 p-3.5 text-xs text-slate-800 italic leading-relaxed">
        &ldquo;{trap.quote}&rdquo;
      </blockquote>

      {/* Explanations: Why it matters & What to do */}
      <div className="space-y-2 text-xs">
        <div>
          <span className="font-bold text-slate-800 uppercase tracking-wide text-[10px] text-slate-500 block">
            Why it matters:
          </span>
          <p className="text-slate-700 leading-relaxed mt-0.5">{trap.why}</p>
        </div>

        <div>
          <span className="font-bold text-slate-800 uppercase tracking-wide text-[10px] text-teal-800 block">
            What to do:
          </span>
          <p className="text-teal-950 font-medium leading-relaxed mt-0.5">{trap.action}</p>
        </div>
      </div>

      {/* Show in Document Button */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
        <button
          type="button"
          onClick={() => onShowInDocument?.(trap.clauseId)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-teal-50 hover:text-teal-800 transition-colors min-h-[44px]"
        >
          <span>Show in document [{trap.clauseId}]</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
