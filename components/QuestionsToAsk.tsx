"use client";

import React from "react";
import { HelpCircle } from "lucide-react";

interface QuestionsToAskProps {
  questions: string[];
}

export default function QuestionsToAsk({ questions }: QuestionsToAskProps) {
  if (!questions || questions.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-5 sm:p-6 space-y-4 border"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-2">
        <HelpCircle
          className="h-4 w-4 shrink-0"
          style={{ color: "var(--primary)" }}
          strokeWidth={1.75}
        />
        <span
          className="font-bold text-sm"
          style={{ color: "var(--foreground)" }}
        >
          Questions to ask before you agree
        </span>
      </div>
      <p className="text-xs" style={{ color: "var(--foreground-2)" }}>
        Ask these directly to the other party to negotiate safer terms.
      </p>

      <ol className="space-y-2">
        {questions.map((q, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2.5 rounded-xl p-3 text-xs leading-relaxed"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border)",
              color: "var(--foreground-2)",
            }}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                backgroundColor: "var(--primary-tint)",
                color: "var(--primary)",
                border: "1px solid var(--primary-border)",
              }}
            >
              {idx + 1}
            </span>
            <span className="font-medium">{q}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
