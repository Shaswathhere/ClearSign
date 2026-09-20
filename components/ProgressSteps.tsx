"use client";

import React from "react";
import { CheckCircle2, Loader2, Circle } from "lucide-react";

export type PipelineStage = 1 | 2 | 3 | 4;

interface ProgressStepsProps {
  currentStage: PipelineStage;
}

const STAGES = [
  { step: 1, label: "Reading document", detail: "Normalizing text and character structure" },
  { step: 2, label: "Finding clauses", detail: "Segmenting into stable C1..Cn clauses" },
  { step: 3, label: "Checking risks", detail: "Running 16 trap rules & structured AI analysis" },
  { step: 4, label: "Verifying quotes", detail: "Eliminating hallucinations against source text" },
];

export default function ProgressSteps({ currentStage }: ProgressStepsProps) {
  return (
    <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="text-center space-y-1">
        <h3 className="text-base font-bold text-slate-900">Analyzing Your Contract</h3>
        <p className="text-xs text-slate-500">Every finding is verified against the original words.</p>
      </div>

      <div className="space-y-4">
        {STAGES.map((s) => {
          const isDone = currentStage > s.step;
          const isCurrent = currentStage === s.step;

          return (
            <div
              key={s.step}
              className={`flex items-start gap-3 p-3 rounded-xl transition-all ${
                isCurrent ? "bg-indigo-50 border border-indigo-200" : isDone ? "opacity-80" : "opacity-40"
              }`}
            >
              <div className="mt-0.5 shrink-0">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : isCurrent ? (
                  <Loader2 className="h-5 w-5 text-indigo-700 animate-spin" />
                ) : (
                  <Circle className="h-5 w-5 text-slate-300" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${isCurrent ? "text-indigo-900" : "text-slate-800"}`}>
                  Stage {s.step}: {s.label}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{s.detail}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
