"use client";

import React from "react";
import { HelpCircle } from "lucide-react";

interface QuestionsToAskProps {
  questions: string[];
}

export default function QuestionsToAsk({ questions }: QuestionsToAskProps) {
  if (!questions || questions.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xs space-y-4">
      <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
        <HelpCircle className="h-4 w-4 text-indigo-700" />
        <span>Questions to Ask Before You Agree</span>
      </div>
      <p className="text-xs text-slate-500">
        Ask these questions directly to the landlord, bank representative, or club manager to negotiate safer terms.
      </p>

      <ul className="space-y-2.5">
        {questions.map((q, idx) => (
          <li
            key={idx}
            className="flex items-start gap-2.5 rounded-xl bg-slate-50 p-3 text-xs text-slate-800 leading-relaxed border border-slate-100"
          >
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold text-indigo-800">
              {idx + 1}
            </span>
            <span className="font-medium">{q}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
