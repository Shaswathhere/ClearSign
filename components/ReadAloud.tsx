"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Play, Pause, VolumeX } from "lucide-react";
import type { SupportedLocale } from "./LanguageSwitch";

interface ReadAloudProps {
  /** Text segments to read in order */
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

  // Stop when locale or segments change
  useEffect(() => {
    window.speechSynthesis?.cancel();
    const timer = setTimeout(() => {
      setPlaying(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [locale, segments]);

  // Stop on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  const getVoice = useCallback(
    (lang: string): SpeechSynthesisVoice | null => {
      const voices = window.speechSynthesis.getVoices();
      return (
        voices.find((v) => v.lang === lang) ||
        voices.find((v) => v.lang.startsWith(lang.slice(0, 2))) ||
        null
      );
    },
    []
  );

  const handleToggle = useCallback(() => {
    if (!("speechSynthesis" in window)) {
      setUnavailable(true);
      return;
    }

    if (playing) {
      window.speechSynthesis.cancel();
      setPlaying(false);
      return;
    }

    const lang = LANG_BCP47[locale];
    const voice = getVoice(lang);

    // If non-English and no matching voice found, warn user
    if (locale !== "en" && !voice) {
      setUnavailable(true);
      return;
    }
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
      <div className="flex items-center gap-1.5 text-[11px] text-slate-400" role="status">
        <VolumeX className="h-3.5 w-3.5 shrink-0" />
        Audio not available for this language on your device.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`flex items-center gap-1.5 text-xs font-semibold transition-colors rounded-lg px-2.5 py-1.5 min-h-[36px] ${
        playing
          ? "bg-teal-700 text-white"
          : "bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200"
      }`}
      aria-label={playing ? "Pause read-aloud" : "Read summary aloud"}
    >
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {playing ? "Pause" : "▶ Listen"}
    </button>
  );
}
