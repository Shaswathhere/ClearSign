import { describe, it, expect } from "vitest";
import { Trap } from "../lib/schema";

describe("Schema Validation", () => {
  it("validates a well-formed trap", () => {
    const validTrap = {
      clauseId: "C1",
      quote: "This membership renews automatically unless cancelled 60 days in advance.",
      category: "auto_renewal",
      severity: "high",
      why: "You will be charged again automatically if you miss the deadline.",
      action: "Set a reminder to cancel 60 days before renewal.",
      question: "Can I cancel via email?",
    };

    const parsed = Trap.safeParse(validTrap);
    expect(parsed.success).toBe(true);
  });

  it("rejects a trap with quote under 20 characters", () => {
    const invalidTrap = {
      clauseId: "C2",
      quote: "Short quote",
      category: "penalty_fee",
      severity: "high",
      why: "Explanation",
      action: "Action",
    };

    const parsed = Trap.safeParse(invalidTrap);
    expect(parsed.success).toBe(false);
  });
});
