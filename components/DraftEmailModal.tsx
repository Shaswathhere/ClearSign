"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Copy, Check, ExternalLink, Loader2, X, Mail } from "lucide-react";
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
      if (!res.ok) throw new Error(data.error?.message || "Failed to draft email");
      setSubject(data.subject || "");
      setBody(data.body || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft email. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [traps, docType]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const timer = setTimeout(() => { if (active) fetchEmail(tone); }, 0);
    return () => { active = false; clearTimeout(timer); };
  }, [isOpen, tone, fetchEmail]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && isOpen) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const mailtoHref = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  if (!isOpen) return null;

  const inputStyle = {
    backgroundColor: "var(--surface-2)",
    color: "var(--foreground)",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    width: "100%",
    padding: "0.5rem 0.75rem",
    fontSize: "0.75rem",
    outline: "none",
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Draft negotiation email"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.75)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh] border"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ backgroundColor: "var(--primary-tint)" }}
            >
              <Mail className="h-5 w-5" style={{ color: "var(--primary)" }} strokeWidth={1.75} />
            </div>
            <div>
              <h2 className="text-sm font-bold" style={{ color: "var(--foreground)" }}>
                Draft negotiation email
              </h2>
              <p className="text-[11px]" style={{ color: "var(--foreground-2)" }}>
                Addresses top {Math.min(3, traps.length)} contract concerns
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{ color: "var(--muted)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--surface-2)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* Tone selector */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
        >
          <span className="text-xs font-semibold" style={{ color: "var(--foreground-2)" }}>
            Tone:
          </span>
          <div
            className="flex gap-1 p-1 rounded-xl"
            style={{ backgroundColor: "var(--background)" }}
          >
            {(["polite", "firm"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTone(t)}
                className="px-3 py-1 text-xs font-semibold rounded-lg transition-all"
                style={{
                  backgroundColor: tone === t ? "var(--primary)" : "transparent",
                  color: tone === t ? "var(--primary-foreground)" : "var(--foreground-2)",
                }}
              >
                {t === "polite" ? "Polite & Inquiring" : "Firm & Protective"}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--primary)" }} strokeWidth={1.75} />
              <p className="text-xs" style={{ color: "var(--foreground-2)" }}>
                Drafting with {tone} tone…
              </p>
            </div>
          ) : error ? (
            <div
              className="p-4 rounded-xl text-xs space-y-2"
              style={{
                backgroundColor: "var(--sev-high-tint)",
                border: "1px solid var(--sev-high)",
                color: "var(--sev-high)",
              }}
            >
              <p className="font-semibold">Failed to generate email</p>
              <p>{error}</p>
              <button
                type="button"
                onClick={() => fetchEmail(tone)}
                className="text-[11px] underline font-semibold"
              >
                Try again
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div>
                <label
                  className="block text-[11px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: "var(--muted)" }}
                >
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={inputStyle}
                  onFocus={(e) => { e.target.style.borderColor = "var(--ring)"; }}
                  onBlur={(e) => { e.target.style.borderColor = "var(--border)"; }}
                />
              </div>
              <div>
                <label
                  className="block text-[11px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: "var(--muted)" }}
                >
                  Email body
                </label>
                <textarea
                  rows={9}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  style={{ ...inputStyle, resize: "vertical" }}
                  onFocus={(e) => { (e.target as HTMLElement).style.borderColor = "var(--ring)"; }}
                  onBlur={(e) => { (e.target as HTMLElement).style.borderColor = "var(--border)"; }}
                />
              </div>
              <p className="text-[10px] italic" style={{ color: "var(--muted)" }}>
                Tip: Customise dates, party names or specific wording before sending.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="p-4 border-t flex items-center justify-between gap-2"
          style={{ borderColor: "var(--border)", backgroundColor: "var(--surface-2)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl transition-colors"
            style={{ color: "var(--foreground-2)" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--border)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "transparent"; }}
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              disabled={loading || !body}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-40"
              style={{
                border: "1px solid var(--border-strong)",
                color: "var(--foreground-2)",
                backgroundColor: "transparent",
              }}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" style={{ color: "var(--sev-low)" }} strokeWidth={1.75} />
              ) : (
                <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
              )}
              {copied ? "Copied!" : "Copy email"}
            </button>
            <a
              href={mailtoHref}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${
                loading || !body ? "pointer-events-none opacity-40" : ""
              }`}
              style={{
                backgroundColor: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
              Open mail
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
