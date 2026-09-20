import { describe, it, expect } from "vitest";
import { verifyTrap } from "../lib/verify";
import { segmentDocument } from "../lib/segment";

describe("Quote Verification (lib/verify.ts)", () => {
  const sampleDocument = `FITPLUS HEALTH CLUB MEMBERSHIP
1. ENROLMENT AND FEES
The annual membership fee is INR 24,000. In addition, an onboarding fee of INR 3,500 shall be collected upon signature. The joining fee and all subscription fees paid are non-refundable under any circumstances whatsoever.

2. AUTO RENEWAL AND CANCELLATION
This Agreement shall automatically renew for successive consecutive terms of twelve months at the prevailing annual membership rate unless terminated. Notice must be submitted exclusively via physical Registered Post sixty days before renewal.`;

  const clauses = segmentDocument(sampleDocument);

  // Case 1: Exact match
  it("Case 1: accepts exact quote match within clause", () => {
    const rawTrap = {
      clauseId: "C2",
      quote: "The joining fee and all subscription fees paid are non-refundable under any circumstances whatsoever.",
      category: "refund_deposit" as const,
      severity: "high" as const,
      why: "Fees are completely non-refundable.",
      action: "Check cancellation terms.",
    };

    const verified = verifyTrap(rawTrap, clauses, sampleDocument);
    expect(verified).not.toBeNull();
    expect(verified?.clauseId).toBe("C2");
    expect(verified?.quote).toContain("non-refundable");
    expect(verified?.start).toBeGreaterThanOrEqual(0);
    expect(verified?.end).toBeGreaterThan(verified?.start || 0);
  });

  // Case 2: Whitespace and curly-quote differences
  it("Case 2: accepts quote with curly quotes, dashes, and whitespace differences", () => {
    const rawTrap = {
      clauseId: "C2",
      quote: "The   joining  fee  and  all  subscription  fees  paid  are  ‘non-refundable’  under  any  circumstances  whatsoever.",
      category: "refund_deposit" as const,
      severity: "high" as const,
      why: "Fees non-refundable.",
      action: "Review fee structure.",
    };

    const verified = verifyTrap(rawTrap, clauses, sampleDocument);
    expect(verified).not.toBeNull();
    // Quote is replaced with source document substring
    expect(verified?.quote).not.toContain("‘");
  });

  // Case 3: Small OCR-style typo accepted
  it("Case 3: accepts small OCR-style typo via fuzzy matching", () => {
    // Small typo: "succesive" instead of "successive"
    const rawTrap = {
      clauseId: "C3",
      quote: "This Agreement shall automatically renew for succesive consecutive terms of twelve months at the prevailing annual membership rate",
      category: "auto_renewal" as const,
      severity: "high" as const,
      why: "Renews automatically.",
      action: "Set cancellation alert.",
    };

    const verified = verifyTrap(rawTrap, clauses, sampleDocument);
    expect(verified).not.toBeNull();
    expect(verified?.clauseId).toBe("C3");
    expect(verified?.quote).toContain("successive"); // replaced with exact source text
  });

  // Case 4: Entirely fabricated quote rejected
  it("Case 4: rejects an entirely fabricated hallucinated quote", () => {
    const fakeTrap = {
      clauseId: "C2",
      quote: "The customer may cancel anytime with a full 100 percent refund within 30 days of registration.",
      category: "refund_deposit" as const,
      severity: "low" as const,
      why: "Free refunds allowed.",
      action: "Claim refund.",
    };

    const verified = verifyTrap(fakeTrap, clauses, sampleDocument);
    expect(verified).toBeNull();
  });

  // Case 5: Quote spanning two clauses handled (or located in different clause)
  it("Case 5: locates quote globally and corrects clauseId if misplaced", () => {
    const misplacedTrap = {
      clauseId: "C1", // Misplaced clause ID provided by LLM
      quote: "Notice must be submitted exclusively via physical Registered Post sixty days before renewal.",
      category: "lock_in_termination" as const,
      severity: "high" as const,
      why: "Requires registered post.",
      action: "Send post early.",
    };

    const verified = verifyTrap(misplacedTrap, clauses, sampleDocument);
    expect(verified).not.toBeNull();
    // Corrected to clause C3 where the text actually lives
    expect(verified?.clauseId).toBe("C3");
  });

  // Case 6: Too-short quote rejected (< 20 characters)
  it("Case 6: rejects quotes under 20 characters", () => {
    const shortTrap = {
      clauseId: "C2",
      quote: "non-refundable.",
      category: "refund_deposit" as const,
      severity: "high" as const,
      why: "Non refundable.",
      action: "Do not pay.",
    };

    const verified = verifyTrap(shortTrap, clauses, sampleDocument);
    expect(verified).toBeNull();
  });
});
