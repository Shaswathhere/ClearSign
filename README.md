# ClearSign

> **Understand before you agree.**

Status: in development during HACKDAY 1.0

---

## Problem Statement

> Every day, billions of people sign rental agreements, loan offers, gym memberships, insurance policies, job contracts and Terms of Service they don't fully understand. Hidden auto-renewals, penalty clauses and one-sided terms cost people money, rights and deadlines, and the people with the least legal or financial literacy lose the most. ClearSign turns any confusing document into a plain-language summary, a list of traps with the exact clause quoted, and an action plan with deadlines, in the user's own language.

---

## Key Differentiators & Planned Features

- **D1 Verified Quotes:** Every identified risk is verified word-for-word against the source document with exact character offsets; unverified AI findings are discarded to eliminate hallucinations.
- **D2 Deadlines to Calendar:** Extracts relative and absolute deadlines (e.g. "60 days before renewal") and generates ready-to-import `.ics` calendar events with advance reminders.
- **D3 Deterministic Cost Engine:** Numeric terms are extracted into structured models while arithmetic (EMI, total interest, early exit penalties, lock-in costs) is calculated deterministically with full formula transparency.
- **D4 Regional Languages & Read-Aloud:** Explanations translated into Indian regional languages (Hindi, Tamil, etc.) with in-browser voice synthesis, while keeping source clauses verbatim.
- **D5 Hybrid Detection:** Fast rule-based regex engine paired with structured LLM analysis, providing resilience and graceful degradation.
- **D6 Missing-Protection Detection:** Flags what a contract standardly omits (e.g., absence of refund terms or missing notice periods).

---

## Product Requirements Document

Full design, architecture, schemas, and specifications are documented in [ClearSign_PRD.md](file:///d:/ClearSign/ClearSign_PRD.md).

---

## Planned Tech Stack

- **Framework:** Next.js (App Router) with TypeScript (strict mode)
- **Styling & UI:** Tailwind CSS, shadcn/ui design tokens, Lucide React icons
- **Validation:** Zod schemas
- **LLM Engine:** Server-side provider-agnostic wrapper (`lib/llm.ts`) powered by Groq (`groq-sdk`) using Llama 3.3 70B & Llama 3.2 Vision for ultra-fast, structured JSON analysis
- **Document Processing:** Client-side `pdfjs-dist` (zero document upload) and `browser-image-compression`
- **Utility Engines:** `fastest-levenshtein`, `date-fns`, `ics`
- **Testing:** Vitest

---

## Getting Started

*(Coming soon as scaffolding is completed in Phase 0)*
