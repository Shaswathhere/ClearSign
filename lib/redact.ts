/**
 * lib/redact.ts - PII redaction for document text before LLM calls (Phase 6)
 * Strips phone numbers, Aadhaar, PAN, email, credit card numbers.
 * Returns both the redacted text and a restoration map.
 */

export interface RedactionResult {
  redacted: string;
  count: number;
}

interface RedactionPattern {
  name: string;
  pattern: RegExp;
  replacement: string;
}

const PATTERNS: RedactionPattern[] = [
  {
    name: "phone_in",
    // Indian mobile: 10 digits optionally prefixed +91 or 0
    pattern: /(?<!\d)(\+91[-\s]?|0)?[6-9]\d{9}(?!\d)/g,
    replacement: "[PHONE]",
  },
  {
    name: "aadhaar",
    // 12-digit Aadhaar (groups of 4)
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
    replacement: "[AADHAAR]",
  },
  {
    name: "pan",
    // PAN: ABCDE1234F
    pattern: /\b[A-Z]{5}\d{4}[A-Z]\b/g,
    replacement: "[PAN]",
  },
  {
    name: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: "[EMAIL]",
  },
  {
    name: "credit_card",
    // 16-digit card numbers
    pattern: /\b(?:\d{4}[\s-]?){3}\d{4}\b/g,
    replacement: "[CARD]",
  },
  {
    name: "ifsc",
    // IFSC code: 4 letters + 0 + 6 alphanumeric
    pattern: /\b[A-Z]{4}0[A-Z0-9]{6}\b/g,
    replacement: "[IFSC]",
  },
];

/**
 * Redact PII from text. Returns the redacted string and the count of redactions.
 * Apply before sending user document text to any LLM route.
 */
export function redactPii(text: string): RedactionResult {
  let redacted = text;
  let count = 0;

  for (const { pattern, replacement } of PATTERNS) {
    const newText = redacted.replace(pattern, (match) => {
      count++;
      void match;
      return replacement;
    });
    redacted = newText;
  }

  return { redacted, count };
}

/**
 * Check if text contains potential PII (for user warnings).
 */
export function hasPii(text: string): boolean {
  return PATTERNS.some((p) => p.pattern.test(text));
}
