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
          className="inline-flex items-center rounded-full text-[10px] font-bold px-1.5 py-0.5 mx-0.5 transition-colors"
          style={{
            backgroundColor: "var(--primary-tint)",
            color: "var(--primary)",
            border: "1px solid var(--primary-border)",
          }}
        >
          {id}
        </button>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

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
      if (!res.ok) throw new Error(data.error?.message || "Failed to get answer.");
      setMessages((prev) => [...prev, { role: "assistant", content: data.answer }]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong.";
      setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${msg}` }]);
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
        <MessageSquareQuote
          className="h-5 w-5 shrink-0"
          style={{ color: "var(--primary)" }}
          strokeWidth={1.75}
        />
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
            Ask this document
          </h3>
          <p className="text-[11px]" style={{ color: "var(--foreground-2)" }}>
            Answers are grounded strictly in the contract clauses.
          </p>
        </div>
      </div>

      {/* Suggested chips */}
      {messages.length === 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Suggested questions
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendMessage(q)}
                disabled={loading}
                className="text-xs rounded-xl px-3 py-2 font-medium transition-colors disabled:opacity-50 text-left"
                style={{
                  border: "1px solid var(--border-strong)",
                  color: "var(--foreground-2)",
                  backgroundColor: "transparent",
                  minHeight: "40px",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--primary-border)";
                  el.style.backgroundColor = "var(--primary-tint)";
                  el.style.color = "var(--primary)";
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--border-strong)";
                  el.style.backgroundColor = "transparent";
                  el.style.color = "var(--foreground-2)";
                }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Message history */}
      {messages.length > 0 && (
        <div
          className="space-y-3 max-h-[420px] overflow-y-auto pr-1"
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed"
                style={
                  msg.role === "user"
                    ? {
                        backgroundColor: "var(--primary-tint)",
                        border: "1px solid var(--primary-border)",
                        color: "var(--primary)",
                        borderBottomRightRadius: "4px",
                      }
                    : {
                        backgroundColor: "var(--surface)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                        borderBottomLeftRadius: "4px",
                      }
                }
              >
                {msg.role === "assistant"
                  ? parseCitations(msg.content, handleJumpToClause)
                  : msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2"
                style={{
                  backgroundColor: "var(--surface)",
                  border: "1px solid var(--border)",
                }}
              >
                <Loader2
                  className="h-4 w-4 animate-spin"
                  style={{ color: "var(--primary)" }}
                  strokeWidth={1.75}
                />
                <span className="text-xs" style={{ color: "var(--foreground-2)" }}>
                  Searching clauses…
                </span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Disclaimer */}
      <div
        className="flex items-start gap-2 rounded-xl p-3"
        style={{
          backgroundColor: "var(--surface-2)",
          border: "1px solid var(--border)",
        }}
      >
        <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--muted)" }} strokeWidth={1.75} />
        <p className="text-[11px] leading-relaxed" style={{ color: "var(--muted)" }}>
          Answers are based only on the text in this document. Tap a{" "}
          <span className="font-bold" style={{ color: "var(--primary)" }}>[C#]</span>{" "}
          citation to jump to that clause. This is not legal advice.
        </p>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about this contract…"
          disabled={loading}
          className="flex-1 rounded-xl px-4 py-3 text-xs outline-none transition-all disabled:opacity-50"
          style={{
            backgroundColor: "var(--surface-2)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
            minHeight: "48px",
            fontSize: "16px",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--ring)";
            e.target.style.boxShadow = "0 0 0 2px var(--primary-tint)";
          }}
          onBlur={(e) => {
            e.target.style.borderColor = "var(--border)";
            e.target.style.boxShadow = "none";
          }}
          aria-label="Question input"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex items-center justify-center rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            backgroundColor: "var(--primary)",
            color: "var(--primary-foreground)",
            minHeight: "48px",
            minWidth: "48px",
            paddingLeft: "1rem",
            paddingRight: "1rem",
          }}
          aria-label="Send question"
          onMouseEnter={(e) => {
            if (!loading && input.trim()) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary-hover)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary)";
          }}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <Send className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>
      </form>
    </div>
  );
}
