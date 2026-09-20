"use client";

import React from "react";

export type SupportedLocale = "en" | "hi" | "ta" | "te" | "kn" | "ml" | "bn" | "mr";

interface LanguageSwitchProps {
  current: SupportedLocale;
  onChange: (locale: SupportedLocale) => void;
  isTranslating?: boolean;
}

const LANGUAGES: { code: SupportedLocale; label: string; nativeLabel: string }[] = [
  { code: "en", label: "English", nativeLabel: "EN" },
  { code: "hi", label: "Hindi", nativeLabel: "हि" },
  { code: "ta", label: "Tamil", nativeLabel: "த" },
  { code: "te", label: "Telugu", nativeLabel: "తె" },
  { code: "kn", label: "Kannada", nativeLabel: "ಕ" },
  { code: "ml", label: "Malayalam", nativeLabel: "മ" },
  { code: "bn", label: "Bengali", nativeLabel: "বা" },
  { code: "mr", label: "Marathi", nativeLabel: "म" },
];

export default function LanguageSwitch({ current, onChange, isTranslating }: LanguageSwitchProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap" role="group" aria-label="Language selection">
      {LANGUAGES.map((lang) => {
        const isActive = lang.code === current;
        return (
          <button
            key={lang.code}
            type="button"
            onClick={() => !isActive && onChange(lang.code)}
            disabled={isTranslating}
            aria-label={lang.label}
            aria-pressed={isActive}
            title={lang.label}
            className={`
              min-h-[36px] min-w-[36px] px-2 py-1 rounded-lg text-xs font-bold transition-all
              disabled:opacity-50 disabled:cursor-not-allowed
              ${isActive
                ? "bg-teal-700 text-white shadow-sm"
                : "bg-white text-slate-600 border border-slate-200 hover:border-teal-400 hover:text-teal-700"
              }
            `}
          >
            {isTranslating && !isActive ? (
              <span className="inline-block animate-pulse">{lang.nativeLabel}</span>
            ) : (
              lang.nativeLabel
            )}
          </button>
        );
      })}
      {isTranslating && (
        <span className="text-[10px] text-teal-600 font-medium animate-pulse">Translating…</span>
      )}
    </div>
  );
}
