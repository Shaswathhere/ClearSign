"use client";

import React, { useState } from "react";
import { FileText, Upload, Camera, ArrowRight, AlertCircle, Sparkles, ShieldCheck } from "lucide-react";
import { extractTextFromPdf } from "@/lib/pdf";
import { redactPii } from "@/lib/redact";
import imageCompression from "browser-image-compression";

interface InputPanelProps {
  onAnalyze: (text: string) => void;
  isLoading?: boolean;
}

export default function InputPanel({ onAnalyze, isLoading = false }: InputPanelProps) {
  const [activeTab, setActiveTab] = useState<"paste" | "pdf" | "photo">("paste");
  const [pasteText, setPasteText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [photoTranscript, setPhotoTranscript] = useState<string | null>(null);
  const [privacyShield, setPrivacyShield] = useState(true);

  // "Try a sample" handler
  const loadSample = async (type: "gym" | "rental" | "loan") => {
    setError(null);
    try {
      let filename = "";
      if (type === "gym") filename = "/samples/gym-membership.txt";
      if (type === "rental") filename = "/samples/rental-agreement.txt";
      if (type === "loan") filename = "/samples/personal-loan.txt";

      const res = await fetch(filename);
      if (!res.ok) throw new Error("Could not load sample file.");
      const text = await res.text();
      setPasteText(text);
      setActiveTab("paste");
      onAnalyze(text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load sample.");
    }
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const len = pasteText.trim().length;
    if (len < 200) {
      setError("Document text is too short. Please provide at least 200 characters for an accurate analysis.");
      return;
    }
    if (len > 60000) {
      setError("Document text exceeds the 60,000 characters limit (~30 pages). Please trim the document.");
      return;
    }
    const finalContent = privacyShield ? redactPii(pasteText).redacted : pasteText;
    onAnalyze(finalContent);
  };

  // PDF Upload handler (100% in-browser extraction via pdf.js)
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setIsProcessingFile(true);

    try {
      const extracted = await extractTextFromPdf(file);
      if (!extracted || extracted.trim().length < 100) {
        setError("Could not extract enough text from this PDF. If it is a scanned image, please take photos and use Photo Upload.");
        return;
      }
      setPasteText(extracted);
      setActiveTab("paste");
      const finalContent = privacyShield ? redactPii(extracted).redacted : extracted;
      onAnalyze(finalContent);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Please make sure the PDF is text-based.";
      setError("Error parsing PDF: " + msg);
    } finally {
      setIsProcessingFile(false);
    }
  };

  // Photo Upload handler with browser compression and /api/transcribe
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (files.length > 5) {
      setError("Maximum 5 photos allowed at a time.");
      return;
    }

    setError(null);
    setIsProcessingFile(true);

    try {
      const compressedB64List: string[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const compressedFile = await imageCompression(file, {
          maxSizeMB: 1,
          maxWidthOrHeight: 1600,
          useWebWorker: true,
        });

        const reader = new FileReader();
        const base64Promise = new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
        });
        reader.readAsDataURL(compressedFile);
        const b64 = await base64Promise;
        compressedB64List.push(b64);
      }

      // Call /api/transcribe
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: compressedB64List }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Transcription failed.");
      }

      // Show S2 confirm screen with transcript
      setPhotoTranscript(data.text);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to process photos.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  // S2 Confirm screen for photo upload
  if (photoTranscript !== null) {
    return (
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Confirm Photo Transcript</h2>
            <p className="text-xs text-slate-500">
              Review the extracted text before analyzing. Edit any words that were captured incorrectly.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setPhotoTranscript(null)}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium"
          >
            Cancel
          </button>
        </div>

        <textarea
          value={photoTranscript}
          onChange={(e) => setPhotoTranscript(e.target.value)}
          rows={12}
          className="w-full rounded-xl border border-slate-300 p-4 font-mono text-xs leading-relaxed text-slate-800 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none"
        />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
            <input
              type="checkbox"
              checked={privacyShield}
              onChange={(e) => setPrivacyShield(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
            />
            <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>Privacy Shield (Mask PAN, Aadhaar, Phone, Email)</span>
          </label>
          <button
            type="button"
            disabled={isLoading || photoTranscript.trim().length < 100}
            onClick={() => {
              const finalContent = privacyShield ? redactPii(photoTranscript).redacted : photoTranscript;
              onAnalyze(finalContent);
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 transition-colors disabled:opacity-50 min-h-[48px]"
          >
            {isLoading ? "Analyzing..." : "Analyze Verified Text"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sample Contract Shortcuts */}
      <div className="bg-indigo-50/70 border border-indigo-200/80 rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-indigo-700" />
          <span className="text-xs font-bold uppercase tracking-wider text-indigo-800">
            Try an Indian sample contract:
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => loadSample("gym")}
            className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 text-left text-xs font-semibold text-slate-800 border border-indigo-200 shadow-2xs hover:border-indigo-600 hover:bg-indigo-50/50 transition-all min-h-[48px]"
          >
            <span>🏋️ Gym Membership</span>
            <ArrowRight className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => loadSample("rental")}
            className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 text-left text-xs font-semibold text-slate-800 border border-indigo-200 shadow-2xs hover:border-indigo-600 hover:bg-indigo-50/50 transition-all min-h-[48px]"
          >
            <span>🏠 Rental Agreement</span>
            <ArrowRight className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          </button>
          <button
            type="button"
            onClick={() => loadSample("loan")}
            className="flex items-center justify-between rounded-xl bg-white px-3.5 py-3 text-left text-xs font-semibold text-slate-800 border border-indigo-200 shadow-2xs hover:border-indigo-600 hover:bg-indigo-50/50 transition-all min-h-[48px]"
          >
            <span>💳 Personal Loan Offer</span>
            <ArrowRight className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          </button>
        </div>
      </div>

      {/* Main Input Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-6 space-y-4">
        <div className="flex border-b border-slate-100 gap-2 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("paste")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[48px] ${
              activeTab === "paste"
                ? "bg-indigo-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText className="h-4 w-4" />
            Paste Text
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("pdf")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[48px] ${
              activeTab === "pdf"
                ? "bg-indigo-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Upload className="h-4 w-4" />
            Upload PDF
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("photo")}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all min-h-[48px] ${
              activeTab === "photo"
                ? "bg-indigo-700 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Camera className="h-4 w-4" />
            Photo / Camera
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Paste Text */}
        {activeTab === "paste" && (
          <form onSubmit={handlePasteSubmit} className="space-y-4">
            <div className="relative">
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Paste contract text, terms of service, loan agreement or rental lease here (minimum 200 characters)..."
                rows={8}
                className="w-full rounded-xl border border-slate-200 p-4 text-sm leading-relaxed text-slate-800 placeholder-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-600/20 outline-none transition-all resize-y"
              />
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400 px-1">
                <span>Min 200 · Max 60,000 characters</span>
                <span className={pasteText.length > 60000 ? "text-rose-600 font-bold" : ""}>
                  {pasteText.length.toLocaleString()} chars
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-2 px-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none py-1">
                <input
                  type="checkbox"
                  checked={privacyShield}
                  onChange={(e) => setPrivacyShield(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 accent-indigo-600"
                />
                <ShieldCheck className="h-4 w-4 text-indigo-600 shrink-0" />
                <span>Privacy Shield: Mask phone numbers, Aadhaar, PAN, emails</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || pasteText.trim().length < 200 || pasteText.length > 60000}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 transition-colors disabled:opacity-50 min-h-[48px]"
            >
              {isLoading ? "Reading and analyzing..." : "Analyze Contract Now"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        )}

        {/* Tab 2: Upload PDF */}
        {activeTab === "pdf" && (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-4 hover:border-indigo-600 transition-colors">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
              <Upload className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                Upload text-based PDF agreement
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Processed 100% inside your browser. The PDF never leaves your device.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-xs font-semibold text-white cursor-pointer hover:bg-indigo-800 transition-colors min-h-[48px]">
              {isProcessingFile ? "Extracting text..." : "Select PDF Document"}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                disabled={isProcessingFile}
                onChange={handlePdfUpload}
              />
            </label>
          </div>
        )}

        {/* Tab 3: Photo / Camera */}
        {activeTab === "photo" && (
          <div className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center space-y-4 hover:border-indigo-600 transition-colors">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">
              <Camera className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-slate-800">
                Photograph printed agreement pages
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Upload 1 to 5 photos. Photos are compressed on your device and transcribed verbatim.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 rounded-xl bg-indigo-700 px-5 py-2.5 text-xs font-semibold text-white cursor-pointer hover:bg-indigo-800 transition-colors min-h-[48px]">
              {isProcessingFile ? "Compressing & Transcribing..." : "Take or Choose Photos"}
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
        )}
      </div>
    </div>
  );
}
