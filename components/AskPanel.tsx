"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Send, MessageSquareQuote, Loader2, Info } from "lucide-react";
import { Clause } from "@/lib/segment";
import { AnalyzeResponse } from "@/lib/schema";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AskPanelProps {
  clauses: Clause[];
  result: AnalyzeResponse;
  onShowInDocument: (clauseId: string) => void;
}

// ─── Suggested chips based on doc type ────────────────────────────────────────

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  rental: [
    "Can I cancel the lease early without penalty?",
    "When and how will my deposit be returned?",
    "Under what conditions can the landlord enter the property?",
  ],
  loan: [
    "What is the exact prepayment penalty?",
    "Can the interest rate change during the loan?",
    "What happens if I miss a payment?",
  ],
  subscription: [
    "How do I cancel before the renewal date?",
    "Are there any fees for cancelling early?",
    "Can the price change without my consent?",
  ],
  insurance: [
    "What is not covered by this policy?",
    "Is there a waiting period for claims?",
    "How do I file a claim?",
  ],
  employment: [
    "What is the notice period to resign?",
    "Does this contract have a non-compete clause?",
    "What are the grounds for termination?",
  ],
  terms_of_service: [
    "Can my data be shared with third parties?",
    "Can the terms change without notice?",
    "How do I delete my account?",
  ],
  other: [
    "What are the main obligations I'm agreeing to?",
    "Are there any automatic renewal terms?",
    "What are the penalty conditions?",
  ],
};

// ─── Citation parser ───────────────────────────────────────────────────────────

function parseCitations(text: string, onJump: (id: string) => void): React.ReactNode {
  const parts = text.split(/(\[C\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[C(\d+)\]$/);
    if (match) {
      const id = `C${match[1]}`;
      return (
        <button
          key={i}
          type="button"
          onClick={() => onJump(id)}
          title={`Jump to clause ${id}`}
          className="inline-flex items-center rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold px-1.5 py-0.5 mx-0.5 hover:bg-indigo-200 transition-colors"
        >
          {id}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function AskPanel({ clauses, result, onShowInDocument }: AskPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestedQuestions = SUGGESTED_QUESTIONS[result.docType] ?? SUGGESTED_QUESTIONS.other;

  const handleJumpToClause = useCallback((id: string) => {
    onShowInDocument(id);
  }, [onShowInDocument]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          clauses: clauses.map((c) => ({ id: c.id, text: c.text })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to get answer.");
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  }, [clauses, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquareQuote className="h-5 w-5 text-indigo-700 shrink-0" />
        <div>
          <h3 className="text-sm font-bold text-slate-900">Ask this Document</h3>
          <p className="text-[11px] text-slate-500">Answers are grounded strictly in the contract clauses.</p>
        </div>
      </div>

      {/* Suggested chips — shown only before first message */}
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Suggested questions</p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                disabled={loading}
                className="text-xs bg-white border border-indigo-200 text-indigo-700 rounded-xl px-3 py-2 hover:bg-indigo-50 transition-colors font-medium min-h-[40px] disabled:opacity-50 text-left"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1" role="log" aria-live="polite">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-700 text-white rounded-br-sm"
                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-sm shadow-xs"
                }`}
              >
                {msg.role === "assistant"
                  ? parseCitations(msg.content, handleJumpToClause)
                  : msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2 shadow-xs">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                <span className="text-xs text-slate-500">Searching clauses…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 bg-slate-50 rounded-xl p-3 border border-slate-200">
        <Info className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed">
          Answers are based only on the text in this document. Tap a <span className="font-bold text-indigo-700">[C#]</span> citation to jump to that clause. This is not legal advice.
        </p>
      </div>

      {/* Input box */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this contract…"
          disabled={loading}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 min-h-[48px]"
          aria-label="Question input"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex items-center justify-center rounded-xl bg-indigo-700 text-white px-4 min-h-[48px] min-w-[48px] hover:bg-indigo-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send question"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
