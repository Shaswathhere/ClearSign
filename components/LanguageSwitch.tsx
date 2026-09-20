"use client";

import React from "react";

export type SupportedLocale = "en" | "hi" | "ta" | "te" | "kn" | "ml" | "bn" | "mr";

interface LanguageSwitchProps {
  current: SupportedLocale;
  onChange: (locale: SupportedLocale) => void;
  isTranslating?: boolean;
}

const LANGUAGES: { code: SupportedLocale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English",    nativeLabel: "English" },
  { code: "hi", label: "Hindi",      nativeLabel: "हिन्दी" },
  { code: "ta", label: "Tamil",      nativeLabel: "தமிழ்" },
  { code: "te", label: "Telugu",     nativeLabel: "తెలుగు" },
  { code: "kn", label: "Kannada",    nativeLabel: "ಕನ್ನಡ" },
  { code: "ml", label: "Malayalam",  nativeLabel: "മലയാളം" },
  { code: "bn", label: "Bengali",    nativeLabel: "বাংলা" },
  { code: "mr", label: "Marathi",    nativeLabel: "मराठी" },
];

export default function LanguageSwitch({ current, onChange, isTranslating }: LanguageSwitchProps) {
  const currentLang = LANGUAGES.find((l) => l.code === current);

  return (
    <div className="flex items-center gap-2">
      {isTranslating && (
        <span className="text-[11px] font-medium animate-pulse" style={{ color: "var(--primary)" }}>
          Translating…
        </span>
      )}
      <select
        id="language-select"
        aria-label="Select language"
        value={current}
        disabled={isTranslating}
        onChange={(e) => onChange(e.target.value as SupportedLocale)}
        className="rounded-xl text-xs font-semibold px-3 py-2 outline-none transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          backgroundColor: "var(--surface-2)",
          color: "var(--foreground)",
          border: "1px solid var(--border-strong)",
          minHeight: "36px",
          minWidth: "120px",
        }}
        onFocus={(e) => { e.target.style.borderColor = "var(--ring)"; e.target.style.boxShadow = "0 0 0 2px var(--primary-tint)"; }}
        onBlur={(e) => { e.target.style.borderColor = "var(--border-strong)"; e.target.style.boxShadow = "none"; }}
      >
        {LANGUAGES.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.nativeLabel}
          </option>
        ))}
      </select>
      {/* Screen-reader label for current selection */}
      <span className="sr-only">Current language: {currentLang?.label}</span>
    </div>
  );
}
