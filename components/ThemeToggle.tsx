"use client";

import React, { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("cs-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("cs-theme", "light");
    }
  };

  if (!mounted) return <div className="h-8 w-8" />;

  return (
    <button
      type="button"
      id="theme-toggle-btn"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="relative flex h-8 w-8 items-center justify-center rounded-lg border transition-all hover:scale-105 active:scale-95"
      style={{
        borderColor: "var(--surface-border)",
        backgroundColor: "var(--surface-muted)",
        color: "var(--text-secondary)",
      }}
    >
      <span className="sr-only">{dark ? "Light mode" : "Dark mode"}</span>
      {dark ? (
        <Sun className="h-4 w-4 text-amber-400 transition-transform rotate-0" />
      ) : (
        <Moon className="h-4 w-4 transition-transform" style={{ color: "var(--brand-500)" }} />
      )}
    </button>
  );
}
