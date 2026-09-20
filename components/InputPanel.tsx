"use client";

import React, { useState, useRef } from "react";
import {
  FileText,
  Upload,
  Camera,
  ArrowRight,
  AlertCircle,
  ShieldCheck,
  Dumbbell,
  Home,
  Landmark,
  Loader2,
} from "lucide-react";
import { extractTextFromPdf } from "@/lib/pdf";
import { redactPii } from "@/lib/redact";
import imageCompression from "browser-image-compression";

interface InputPanelProps {
  onAnalyze: (text: string) => void;
  onSample: (key: string, file: string) => void;
  isLoading?: boolean;
  loadingSampleKey?: string | null;
}

const SAMPLES = [
  { key: "gym-membership",   label: "Gym membership",    file: "/samples/gym-membership.txt",  Icon: Dumbbell },
  { key: "rental-agreement", label: "Rental agreement",  file: "/samples/rental-agreement.txt", Icon: Home },
  { key: "personal-loan",    label: "Personal loan",     file: "/samples/personal-loan.txt",    Icon: Landmark },
] as const;

type TabId = "paste" | "pdf" | "photo";

const TABS: { id: TabId; label: string; Icon: React.ComponentType<{ className?: string; strokeWidth?: number }> }[] = [
  { id: "paste", label: "Paste text", Icon: FileText },
  { id: "pdf",   label: "Upload PDF", Icon: Upload },
  { id: "photo", label: "Photo",      Icon: Camera },
];

export default function InputPanel({
  onAnalyze,
  onSample,
  isLoading = false,
  loadingSampleKey = null,
}: InputPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("paste");
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [photoTranscript, setPhotoTranscript] = useState<string | null>(null);
  const [privacyShield, setPrivacyShield] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const MIN_CHARS = 200;

  /* ── handlers ── */
  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const len = pasteText.trim().length;
    if (len < MIN_CHARS) {
      setError("Document text is too short. Please provide at least 200 characters.");
      return;
    }
    if (len > 60000) {
      setError("Document exceeds 60,000 characters (~30 pages). Please trim it.");
      return;
    }
    const finalContent = privacyShield ? redactPii(pasteText).redacted : pasteText;
    onAnalyze(finalContent);
  };

  const processPdf = async (file: File) => {
    setError(null);
    setIsProcessingFile(true);
    try {
      const extracted = await extractTextFromPdf(file);
      if (!extracted || extracted.trim().length < 100) {
        setError("Could not extract text from this PDF. If it is scanned, use Photo instead.");
        return;
      }
      const finalContent = privacyShield ? redactPii(extracted).redacted : extracted;
      onAnalyze(finalContent);
    } catch (err: unknown) {
      setError("Error parsing PDF: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processPdf(file);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type === "application/pdf") {
      await processPdf(file);
    } else {
      setError("Please drop a PDF file.");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (files.length > 5) {
      setError("Maximum 5 photos allowed.");
      return;
    }
    setError(null);
    setIsProcessingFile(true);
    try {
      const compressedB64List: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const compressed = await imageCompression(files[i], {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        });
        const b64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(compressed);
        });
        compressedB64List.push(b64);
      }
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: compressedB64List }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || "Transcription failed.");
      setPhotoTranscript(data.text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process photos.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  /* ── Photo confirm screen ── */
  if (photoTranscript !== null) {
    return (
      <div
        className="rounded-2xl p-6 sm:p-8 space-y-5 border"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: "var(--border)" }}>
          <div>
            <h2 className="text-base font-bold" style={{ color: "var(--foreground)" }}>
              Confirm Photo Transcript
            </h2>
            <p className="text-xs mt-0.5" style={{ color: "var(--foreground-2)" }}>
              Review and edit the extracted text before analyzing.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPhotoTranscript(null)}
            className="text-xs font-semibold transition-colors"
            style={{ color: "var(--muted)" }}
          >
            Cancel
          </button>
        </div>

        <textarea
          value={photoTranscript}
          onChange={(e) => setPhotoTranscript(e.target.value)}
          rows={12}
          className="w-full rounded-xl p-4 font-mono text-xs leading-relaxed outline-none transition-all resize-y"
          style={{
            backgroundColor: "var(--surface-2)",
            color: "var(--foreground)",
            border: "1px solid var(--border)",
          }}
          onFocus={(e) => (e.target.style.borderColor = "var(--primary)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--border)")}
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <label
            className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none"
            style={{ color: "var(--foreground-2)" }}
          >
            <input
              type="checkbox"
              checked={privacyShield}
              onChange={(e) => setPrivacyShield(e.target.checked)}
              className="h-4 w-4 rounded"
              style={{ accentColor: "var(--primary)" }}
            />
            <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} strokeWidth={1.75} />
            <span>Hide phone, email and ID numbers before analysis</span>
          </label>
          <button
            type="button"
            disabled={isLoading || photoTranscript.trim().length < 100}
            onClick={() => {
              const finalContent = privacyShield ? redactPii(photoTranscript).redacted : photoTranscript;
              onAnalyze(finalContent);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              height: "48px",
              borderRadius: "var(--radius-btn)",
              backgroundColor: "var(--primary)",
              color: "var(--primary-foreground)",
              fontSize: "0.875rem",
            }}
          >
            {isLoading ? "Analyzing…" : "Analyze verified text"}
            <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>
    );
  }

  const canSubmitPaste = !isLoading && !isProcessingFile && pasteText.trim().length >= MIN_CHARS && pasteText.length <= 60000;

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* ── Segmented tab bar ── */}
      <div
        className="flex border-b"
        role="tablist"
        aria-label="Input method"
        style={{ borderColor: "var(--border)" }}
      >
        {TABS.map(({ id, label, Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`input-tab-${id}`}
              aria-selected={isActive}
              aria-controls={`input-panel-${id}`}
              onClick={() => { setActiveTab(id); setError(null); }}
              className="flex items-center gap-2 px-4 py-3.5 text-xs font-semibold transition-all shrink-0 flex-1 justify-center"
              style={{
                color: isActive ? "var(--primary)" : "var(--foreground-2)",
                backgroundColor: isActive ? "var(--primary-tint)" : "transparent",
                borderBottom: isActive ? "2px solid var(--primary)" : "2px solid transparent",
                minHeight: "48px",
              }}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="p-5 sm:p-6 space-y-4">
        {/* Error banner */}
        {error && (
          <div
            className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs"
            style={{
              backgroundColor: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.30)",
              color: "var(--sev-high)",
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
        )}

        {/* Paste */}
        {activeTab === "paste" && (
          <form
            id="input-panel-paste"
            role="tabpanel"
            aria-labelledby="input-tab-paste"
            onSubmit={handlePasteSubmit}
            className="space-y-4"
          >
            <div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste contract text, terms of service, loan agreement or rental lease here…"
                rows={8}
                aria-label="Contract text"
                className="w-full rounded-xl p-4 text-sm leading-relaxed outline-none transition-all resize-y"
                style={{
                  minHeight: "200px",
                  backgroundColor: "var(--surface-2)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  fontSize: "16px",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--primary)";
                  e.target.style.boxShadow = "0 0 0 2px var(--primary-tint)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border)";
                  e.target.style.boxShadow = "none";
                }}
              />
              <div className="mt-1.5 flex items-center justify-between px-1">
                <span className="text-[11px]" style={{ color: "var(--muted)" }}>
                  {pasteText.trim().length} / {MIN_CHARS} minimum characters
                </span>
                {pasteText.length > 60000 && (
                  <span className="text-[11px] font-bold" style={{ color: "var(--sev-high)" }}>
                    Too long (max 60,000)
                  </span>
                )}
              </div>
            </div>

            {/* Privacy + Submit */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <label
                className="flex items-center gap-2 cursor-pointer text-xs font-semibold select-none"
                style={{ color: "var(--foreground-2)" }}
              >
                <input
                  type="checkbox"
                  checked={privacyShield}
                  onChange={(e) => setPrivacyShield(e.target.checked)}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: "var(--primary)" }}
                />
                <ShieldCheck className="h-4 w-4 shrink-0" style={{ color: "var(--primary)" }} strokeWidth={1.75} />
                Hide phone, email and ID numbers before analysis
              </label>
              <button
                type="submit"
                disabled={!canSubmitPaste}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  height: "48px",
                  borderRadius: "var(--radius-btn)",
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                  paddingLeft: "1.5rem",
                  paddingRight: "1.5rem",
                  fontSize: "0.875rem",
                }}
                onMouseEnter={(e) => { if (canSubmitPaste) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary-hover)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary)"; }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                    Analyzing…
                  </>
                ) : (
                  <>
                    Analyze document
                    <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Upload PDF */}
        {activeTab === "pdf" && (
          <div
            id="input-panel-pdf"
            role="tabpanel"
            aria-labelledby="input-tab-pdf"
          >
            <div
              className="rounded-xl p-8 text-center space-y-4 transition-all cursor-pointer"
              style={{
                border: `2px dashed ${isDragging ? "var(--primary)" : "var(--border-strong)"}`,
                backgroundColor: isDragging ? "var(--primary-tint)" : "var(--surface-2)",
              }}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => pdfInputRef.current?.click()}
            >
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--primary-tint)", color: "var(--primary)" }}
              >
                <Upload className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  {isDragging ? "Drop PDF here" : "Upload text-based PDF"}
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-2)" }}>
                  Processed inside your browser. The PDF never leaves your device.
                </p>
              </div>
              <label
                className="inline-flex items-center gap-2 font-semibold cursor-pointer transition-colors"
                style={{
                  height: "48px",
                  borderRadius: "var(--radius-btn)",
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                  paddingLeft: "1.25rem",
                  paddingRight: "1.25rem",
                  fontSize: "0.75rem",
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {isProcessingFile ? "Extracting text…" : "Select PDF document"}
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  disabled={isProcessingFile}
                  onChange={handlePdfUpload}
                />
              </label>
            </div>
          </div>
        )}

        {/* Photo */}
        {activeTab === "photo" && (
          <div
            id="input-panel-photo"
            role="tabpanel"
            aria-labelledby="input-tab-photo"
          >
            <div
              className="rounded-xl p-8 text-center space-y-4"
              style={{
                border: `2px dashed var(--border-strong)`,
                backgroundColor: "var(--surface-2)",
              }}
            >
              <div
                className="mx-auto flex h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--primary-tint)", color: "var(--primary)" }}
              >
                <Camera className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
                  Photograph printed agreement pages
                </p>
                <p className="text-xs" style={{ color: "var(--foreground-2)" }}>
                  Up to 5 photos. Compressed on your device, transcribed word for word.
                </p>
              </div>
              <label
                className="inline-flex items-center gap-2 font-semibold cursor-pointer transition-colors"
                style={{
                  height: "48px",
                  borderRadius: "var(--radius-btn)",
                  backgroundColor: "var(--primary)",
                  color: "var(--primary-foreground)",
                  paddingLeft: "1.25rem",
                  paddingRight: "1.25rem",
                  fontSize: "0.75rem",
                }}
              >
                {isProcessingFile ? "Compressing & Transcribing…" : "Take or choose photos"}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  disabled={isProcessingFile}
                  onChange={handlePhotoUpload}
                />
              </label>
            </div>
          </div>
        )}

        {/* ── Divider + samples (inside the card) ── */}
        <div
          className="flex items-center gap-3 pt-1"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <span className="text-xs pt-3" style={{ color: "var(--muted)" }}>
            No document handy? Try a sample:
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {SAMPLES.map(({ key, label, file, Icon }) => {
            const loading = loadingSampleKey === key;
            return (
              <button
                key={key}
                type="button"
                id={`sample-btn-${key}`}
                onClick={() => onSample(key, file)}
                disabled={isLoading || !!loadingSampleKey}
                className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "transparent",
                  color: "var(--foreground-2)",
                  border: "1px solid var(--border-strong)",
                  minHeight: "40px",
                }}
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLElement;
                  el.style.borderColor = "var(--primary)";
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
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
