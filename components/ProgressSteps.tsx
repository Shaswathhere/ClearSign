"use client";

import React from "react";
import { CheckCircle2, Loader2, Circle } from "lucide-react";

export type PipelineStage = 1 | 2 | 3 | 4;

interface ProgressStepsProps {
  currentStage: PipelineStage;
}

const STAGES = [
  { step: 1, label: "Reading document",  detail: "Normalising text and character structure" },
  { step: 2, label: "Finding clauses",   detail: "Segmenting into stable clause boundaries" },
  { step: 3, label: "Checking risks",    detail: "Running trap rules & structured AI analysis" },
  { step: 4, label: "Verifying quotes",  detail: "Eliminating hallucinations against source text" },
] as const;

export default function ProgressSteps({ currentStage }: ProgressStepsProps) {
  return (
    <div className="w-full max-w-md mx-auto space-y-6" aria-live="polite" aria-label="Analysis progress">
      {/* Stepper card */}
      <div
        className="rounded-2xl p-6 space-y-4 border"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="text-center space-y-1">
          <h3 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
            Analyzing your document
          </h3>
          <p className="text-xs" style={{ color: "var(--foreground-2)" }}>
            Every quote is verified against your document.
          </p>
        </div>

        <div className="space-y-2.5">
          {STAGES.map((s) => {
            const isDone = currentStage > s.step;
            const isCurrent = currentStage === s.step;
            return (
              <div
                key={s.step}
                className="flex items-start gap-3 p-3 rounded-xl transition-all"
                style={{
                  backgroundColor: isCurrent ? "var(--primary-tint)" : "transparent",
                  border: isCurrent ? "1px solid var(--primary-border)" : "1px solid transparent",
                  opacity: !isDone && !isCurrent ? 0.35 : 1,
                }}
              >
                <div className="mt-0.5 shrink-0">
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5" style={{ color: "var(--sev-low)" }} strokeWidth={1.75} />
                  ) : isCurrent ? (
                    <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--primary)" }} strokeWidth={1.75} />
                  ) : (
                    <Circle className="h-5 w-5" style={{ color: "var(--muted)" }} strokeWidth={1.75} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p
                    className="text-xs font-bold"
                    style={{ color: isCurrent ? "var(--primary)" : isDone ? "var(--foreground)" : "var(--muted)" }}
                  >
                    {s.label}
                  </p>
                  <p className="text-[11px] truncate" style={{ color: "var(--muted)" }}>
                    {s.detail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skeleton result cards */}
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className="rounded-2xl p-5 border space-y-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-3">
            <div className="skeleton h-4 w-20 rounded" />
            <div className="skeleton h-4 w-12 rounded" />
          </div>
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
          <div className="skeleton h-3 w-3/5 rounded" />
        </div>
      ))}
    </div>
  );
}
