import { describe, it, expect } from "vitest";
import { calculateRiskScore, getBandDetails } from "../lib/score";
import { VerifiedTrap } from "../lib/schema";

describe("Deterministic Risk Scoring (lib/score.ts)", () => {
  it("returns 0 and low band for empty traps", () => {
    const res = calculateRiskScore([]);
    expect(res.score).toBe(0);
    expect(res.band).toBe("low");
  });

  it("calculates correct PRD example: 2 high + 1 medium => ~58 (high band)", () => {
    // 1 - (0.70 * 0.70 * 0.85) = 1 - 0.4165 = 0.5835 => 58
    const traps: VerifiedTrap[] = [
      {
        clauseId: "C1",
        quote: "High risk clause text exceeding twenty chars",
        category: "auto_renewal",
        severity: "high",
        why: "Why text",
        action: "Action text",
        start: 0,
        end: 45,
        source: "llm",
      },
      {
        clauseId: "C2",
        quote: "Second high risk clause text exceeding twenty chars",
        category: "refund_deposit",
        severity: "high",
        why: "Why text",
        action: "Action text",
        start: 50,
        end: 100,
        source: "llm",
      },
      {
        clauseId: "C3",
        quote: "Medium risk clause text exceeding twenty chars",
        category: "interest_rate",
        severity: "medium",
        why: "Why text",
        action: "Action text",
        start: 110,
        end: 155,
        source: "llm",
      },
    ];

    const res = calculateRiskScore(traps);
    expect(res.score).toBe(58);
    expect(res.band).toBe("high");
  });

  it("counts each clause only once at its highest severity", () => {
    // C1 has both high and low findings; should only count as high (0.30)
    const traps: VerifiedTrap[] = [
      {
        clauseId: "C1",
        quote: "High risk finding in clause 1",
        category: "auto_renewal",
        severity: "high",
        why: "Why text",
        action: "Action text",
        start: 0,
        end: 30,
        source: "llm",
      },
      {
        clauseId: "C1",
        quote: "Low risk finding in clause 1",
        category: "hidden_charges",
        severity: "low",
        why: "Why text",
        action: "Action text",
        start: 35,
        end: 65,
        source: "llm",
      },
    ];

    // Single high risk => 1 - 0.7 = 30
    const res = calculateRiskScore(traps);
    expect(res.score).toBe(30);
    expect(res.band).toBe("moderate");
  });

  it("classifies risk bands accurately", () => {
    expect(getBandDetails(15).band).toBe("low");
    expect(getBandDetails(35).band).toBe("moderate");
    expect(getBandDetails(60).band).toBe("high");
    expect(getBandDetails(85).band).toBe("severe");
  });
});
