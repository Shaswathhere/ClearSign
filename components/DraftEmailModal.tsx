"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Copy, Check, ExternalLink, Loader2, X, Sparkles } from "lucide-react";
import type { VerifiedTrap } from "@/lib/schema";

interface DraftEmailModalProps {
  traps: VerifiedTrap[];
  docType?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function DraftEmailModal({ traps, docType, isOpen, onClose }: DraftEmailModalProps) {
  const [tone, setTone] = useState<"polite" | "firm">("polite");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchEmail = useCallback(async (selectedTone: "polite" | "firm") => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/draft-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tone: selectedTone,
          traps: traps.slice(0, 3).map((t) => ({
            clauseId: t.clauseId,
            quote: t.quote,
            category: t.category,
            severity: t.severity,
            why: t.why,
            action: t.action,
          })),
          docType,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to draft email");
      }

      setSubject(data.subject || "");
      setBody(data.body || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft email. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [traps, docType]);

  // Fetch when opened or tone changed
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const timer = setTimeout(() => {
      if (active) {
        fetchEmail(tone);
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [isOpen, tone, fetchEmail]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleCopy = async () => {
    try {
      const fullText = `Subject: ${subject}\n\n${body}`;
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Draft Negotiation Email"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Draft Negotiation Email</h2>
              <p className="text-[11px] text-slate-500">Addresses top {Math.min(3, traps.length)} contract concerns</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tone Selector */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 border-b border-slate-100">
          <span className="text-xs font-semibold text-slate-700">Tone:</span>
          <div className="flex gap-1.5 bg-slate-200/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTone("polite")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                tone === "polite"
                  ? "bg-white text-indigo-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Polite & Inquiring
            </button>
            <button
              type="button"
              onClick={() => setTone("firm")}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                tone === "firm"
                  ? "bg-white text-indigo-800 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Firm & Protective
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              <p className="text-xs">Drafting negotiation email with {tone} tone...</p>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 space-y-2">
              <p className="font-semibold">Failed to generate email</p>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => fetchEmail(tone)}
                className="text-[11px] underline font-semibold text-rose-800"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                  Email Body
                </label>
                <textarea
                  rows={9}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 text-xs leading-relaxed"
                />
              </div>

              <p className="text-[10px] text-slate-400 italic">
                Tip: Feel free to customize dates, party names, or specific wording before sending.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-slate-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-200/50 transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || !body}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-xs disabled:opacity-40 transition-colors"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied!" : "Copy Email"}
            </button>
            <a
              href={mailtoHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-semibold shadow-xs transition-colors ${
                loading || !body ? "pointer-events-none opacity-40" : ""
              }`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open Mail
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
