"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Volume2, Pause, VolumeX } from "lucide-react";
import type { SupportedLocale } from "./LanguageSwitch";

interface ReadAloudProps {
  segments: string[];
  locale: SupportedLocale;
}

const LANG_BCP47: Record<SupportedLocale, string> = {
  en: "en-IN",
  hi: "hi-IN",
  ta: "ta-IN",
  te: "te-IN",
  kn: "kn-IN",
  ml: "ml-IN",
  bn: "bn-IN",
  mr: "mr-IN",
};

export default function ReadAloud({ segments, locale }: ReadAloudProps) {
  const [playing, setPlaying] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    window.speechSynthesis?.cancel();
    const timer = setTimeout(() => setPlaying(false), 0);
    return () => clearTimeout(timer);
  }, [locale, segments]);

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  const getVoice = useCallback((lang: string): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang === lang) ||
      voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ||
      null
    );
  }, []);

  const handleToggle = useCallback(() => {
    if (!("speechSynthesis" in window)) { setUnavailable(true); return; }
    if (playing) { window.speechSynthesis.cancel(); setPlaying(false); return; }
    const lang = LANG_BCP47[locale];
    const voice = getVoice(lang);
    if (locale !== "en" && !voice) { setUnavailable(true); return; }
    setUnavailable(false);
    const fullText = segments.join(". ");
    const utter = new SpeechSynthesisUtterance(fullText);
    utter.lang = lang;
    if (voice) utter.voice = voice;
    utter.rate = 0.95;
    utter.onend = () => setPlaying(false);
    utter.onerror = () => setPlaying(false);
    utterRef.current = utter;
    window.speechSynthesis.speak(utter);
    setPlaying(true);
  }, [playing, locale, segments, getVoice]);

  if (unavailable) {
    return (
      <div
        className="flex items-center gap-1.5 text-[11px]"
        role="status"
        style={{ color: "var(--muted)" }}
      >
        <VolumeX className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
        Audio unavailable for this language.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="flex items-center gap-1.5 text-xs font-semibold transition-colors rounded-xl px-4"
      style={{
        height: "40px",
        backgroundColor: playing ? "var(--primary-hover)" : "var(--primary)",
        color: "var(--primary-foreground)",
        minWidth: "96px",
      }}
      aria-label={playing ? "Pause read-aloud" : "Read summary aloud"}
      onMouseEnter={(e) => {
        if (!playing) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary-hover)";
      }}
      onMouseLeave={(e) => {
        if (!playing) (e.currentTarget as HTMLElement).style.backgroundColor = "var(--primary)";
      }}
    >
      {playing ? (
        <Pause className="h-4 w-4" strokeWidth={1.75} />
      ) : (
        <Volume2 className="h-4 w-4" strokeWidth={1.75} />
      )}
      {playing ? "Pause" : "Listen"}
    </button>
  );
}
