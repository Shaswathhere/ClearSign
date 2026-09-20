"use client";

import React from "react";
import { AlertTriangle, CheckCircle, AlertOctagon, ShieldAlert, Sparkles, ShieldCheck } from "lucide-react";
import { RiskBand } from "@/lib/score";

interface VerdictCardProps {
  score: number;
  band: RiskBand;
  summary: string[];
  docType?: string;
  removedUnverified?: number;
  clauseCount?: number;
}

export default function VerdictCard({
  score,
  band,
  summary,
  docType = "Contract",
  removedUnverified = 0,
  clauseCount = 0,
}: VerdictCardProps) {
  const getBandConfig = () => {
    switch (band) {
      case "low":
        return {
          icon: <CheckCircle className="h-5 w-5 text-emerald-700" />,
          badgeBg: "bg-emerald-100 text-emerald-900 border-emerald-300",
          cardBorder: "border-emerald-200",
          title: "LOW RISK",
          subtitle: "Looks fairly standard",
          dotColor: "bg-emerald-500",
        };
      case "moderate":
        return {
          icon: <AlertTriangle className="h-5 w-5 text-amber-700" />,
          badgeBg: "bg-amber-100 text-amber-900 border-amber-300",
          cardBorder: "border-amber-200",
          title: "MODERATE RISK",
          subtitle: "Review before signing",
          dotColor: "bg-amber-500",
        };
      case "high":
        return {
          icon: <ShieldAlert className="h-5 w-5 text-rose-700" />,
          badgeBg: "bg-rose-100 text-rose-900 border-rose-300",
          cardBorder: "border-rose-200",
          title: "HIGH RISK",
          subtitle: "Negotiate or get advice first",
          dotColor: "bg-rose-600",
        };
      case "severe":
      default:
        return {
          icon: <AlertOctagon className="h-5 w-5 text-red-900" />,
          badgeBg: "bg-red-100 text-red-950 border-red-300",
          cardBorder: "border-red-300",
          title: "SEVERE RISK",
          subtitle: "Serious concerns, get advice before signing",
          dotColor: "bg-red-700",
        };
    }
  };

  const config = getBandConfig();

  const formattedDocType = docType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className={`rounded-2xl border-2 ${config.cardBorder} bg-white p-5 sm:p-7 shadow-sm space-y-5 transition-all`}>
      {/* Top Banner: Verdict & Score */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-extrabold uppercase tracking-wider border ${config.badgeBg}`}
            >
              {config.icon}
              {config.title}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
              📄 {formattedDocType} {clauseCount > 0 && `· ${clauseCount} clauses`}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-700">{config.subtitle}</p>
        </div>

        {/* Big Score Indicator */}
        <div className="flex items-baseline gap-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 self-start sm:self-auto">
          <span className="text-3xl font-black text-slate-900 tracking-tight">{score}</span>
          <span className="text-xs font-bold text-slate-400">/ 100</span>
        </div>
      </div>

      {/* 5-Line Summary */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-teal-700" /> Key Takeaways
        </h4>
        <ul className="space-y-1.5 text-sm text-slate-800 leading-relaxed">
          {summary.map((point, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-700 mt-2 shrink-0" />
              <span>{point}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Transparency Stat & Legal Disclaimer Notice */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
        {removedUnverified > 0 ? (
          <span className="inline-flex items-center gap-1.5 text-slate-600 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <strong>{removedUnverified}</strong> unverified AI findings removed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            All findings verified with source text
          </span>
        )}

        <span className="text-slate-500 font-medium italic">
          Reading aid, not legal advice
        </span>
      </div>
    </div>
  );
}
