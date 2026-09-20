/**
 * lib/score.ts
 * Deterministic risk scoring per ClearSign PRD Section 13.5.
 * 
 * Formula:
 * Weights: high = 0.30, medium = 0.15, low = 0.05.
 * Each clause is counted once at its highest severity.
 * Score = round(100 * (1 - Π(1 - w_i)))
 * 
 * Bands:
 * 0-24: low ("Looks fairly standard")
 * 25-49: moderate ("Review before signing")
 * 50-74: high ("Negotiate or get advice first")
 * 75-100: severe ("Serious concerns, get advice before signing")
 */

import { VerifiedTrap } from "./schema";

export type RiskBand = "low" | "moderate" | "high" | "severe";

export interface ScoreResult {
  score: number;
  band: RiskBand;
  label: string;
}

const SEVERITY_WEIGHTS: Record<"low" | "medium" | "high", number> = {
  high: 0.30,
  medium: 0.15,
  low: 0.05,
};

const SEVERITY_RANK: Record<"low" | "medium" | "high", number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export function getBandDetails(score: number): { band: RiskBand; label: string } {
  if (score <= 24) {
    return { band: "low", label: "Looks fairly standard" };
  }
  if (score <= 49) {
    return { band: "moderate", label: "Review before signing" };
  }
  if (score <= 74) {
    return { band: "high", label: "Negotiate or get advice first" };
  }
  return { band: "severe", label: "Serious concerns, get advice before signing" };
}

/**
 * Computes deterministic score and risk band from verified traps.
 */
export function calculateRiskScore(traps: VerifiedTrap[]): ScoreResult {
  if (!traps || traps.length === 0) {
    return {
      score: 0,
      band: "low",
      label: "Looks fairly standard",
    };
  }

  // Count each clause once using its highest severity
  const clauseHighestSeverity = new Map<string, "low" | "medium" | "high">();

  for (const trap of traps) {
    const current = clauseHighestSeverity.get(trap.clauseId);
    if (!current || SEVERITY_RANK[trap.severity] > SEVERITY_RANK[current]) {
      clauseHighestSeverity.set(trap.clauseId, trap.severity);
    }
  }

  // Combined diminishing product: 1 - Π(1 - w_i)
  let product = 1.0;
  for (const severity of clauseHighestSeverity.values()) {
    const weight = SEVERITY_WEIGHTS[severity];
    product *= (1.0 - weight);
  }

  const rawScore = 100 * (1.0 - product);
  const score = Math.min(100, Math.max(0, Math.round(rawScore)));
  const { band, label } = getBandDetails(score);

  return { score, band, label };
}
