/**
 * lib/rules.ts
 * Deterministic regex-based rule engine implementing all 16 contract trap rules
 * per ClearSign PRD Section 13.2.
 */

import { Category, Severity, Trap } from "./schema";
import { Clause } from "./segment";
import { z } from "zod";

type CategoryType = z.infer<typeof Category>;
type SeverityType = z.infer<typeof Severity>;

export interface RuleDefinition {
  id: string;
  name: string;
  category: CategoryType;
  severity: SeverityType;
  pattern: RegExp;
  whyTemplate: string;
  actionTemplate: string;
}

export const CONTRACT_RULES: RuleDefinition[] = [
  {
    id: "R1",
    name: "Auto-renewal",
    category: "auto_renewal",
    severity: "high",
    pattern: /auto(?:matically)?[- ]?renew|renews?(?:\s+automatically)?|evergreen/i,
    whyTemplate: "This contract automatically renews unless you take specific action to stop it.",
    actionTemplate: "Mark the non-renewal deadline on your calendar.",
  },
  {
    id: "R2",
    name: "Lock-in / Minimum Term",
    category: "lock_in_termination",
    severity: "medium",
    pattern: /lock[- ]?in|minimum (?:term|period)|notice period of \d+/i,
    whyTemplate: "You are committed to a minimum period before you can exit without penalty.",
    actionTemplate: "Check if your schedule allows committing to the full lock-in tenure.",
  },
  {
    id: "R3",
    name: "Non-refundable / Forfeit",
    category: "refund_deposit",
    severity: "high",
    pattern: /non[- ]?refundable|no refund|forfeit/i,
    whyTemplate: "Money paid under this clause cannot be recovered under any circumstances.",
    actionTemplate: "Negotiate pro-rata refund terms in writing before signing.",
  },
  {
    id: "R4",
    name: "Penalty / Early Exit",
    category: "penalty_fee",
    severity: "high",
    pattern: /penalt(?:y|ies)|liquidated damages|foreclosure (?:charge|fee)|prepayment (?:charge|penalty)|early (?:termination|closure) (?:fee|charge)/i,
    whyTemplate: "Exiting early or repaying ahead of time triggers financial penalties.",
    actionTemplate: "Calculate the exact early closure cost before agreeing.",
  },
  {
    id: "R5",
    name: "Unilateral Change",
    category: "unilateral_change",
    severity: "high",
    pattern: /reserves?(?:\s+the)?\s+right to (?:change|modify|amend|revise)|sole discretion|without (?:prior )?notice/i,
    whyTemplate: "The provider can alter charges or terms at any time without asking you.",
    actionTemplate: "Request a clause requiring at least 30 days prior written notice for any change.",
  },
  {
    id: "R6",
    name: "Variable / Floating Rate",
    category: "interest_rate",
    severity: "medium",
    pattern: /floating rate|variable (?:interest )?rate|rate .* subject to change|benchmark reset/i,
    whyTemplate: "Your interest rate and EMI can increase if market rates rise.",
    actionTemplate: "Ask what benchmark rate this loan is linked to and when it resets.",
  },
  {
    id: "R7",
    name: "Late Fee / Penal Interest",
    category: "penalty_fee",
    severity: "medium",
    pattern: /late (?:payment )?(?:fee|charge)|penal interest|compound(?:ed)?/i,
    whyTemplate: "Overdue payments attract punitive compounding interest or daily fees.",
    actionTemplate: "Set up auto-debit reminders 3 days before every due date.",
  },
  {
    id: "R8",
    name: "Arbitration / Jurisdiction Waiver",
    category: "arbitration_jurisdiction",
    severity: "medium",
    pattern: /arbitrat|exclusive jurisdiction|waive[sd]?(?:\s+the|\s+any)?\s+right|class action/i,
    whyTemplate: "Disputes must be handled via private arbitration, potentially in another city.",
    actionTemplate: "Check where disputes must be heard and whether you can choose local courts.",
  },
  {
    id: "R9",
    name: "Indemnity / Liability Limitation",
    category: "liability_indemnity",
    severity: "medium",
    pattern: /indemnif|hold harmless|not (?:be )?liable|limitation of liability/i,
    whyTemplate: "The provider limits its liability even if you suffer damages or losses.",
    actionTemplate: "Clarify what protections or insurance coverage apply to you.",
  },
  {
    id: "R10",
    name: "Data Sharing & Marketing",
    category: "data_privacy",
    severity: "medium",
    pattern: /share (?:your )?(?:data|information) with|sell (?:your )?(?:data|personal)|marketing purposes|third[- ]part(?:y|ies)/i,
    whyTemplate: "Your personal, contact, or financial information may be shared with external third parties.",
    actionTemplate: "Ask if you can opt out of third-party marketing and data sharing.",
  },
  {
    id: "R11",
    name: "Deposit Deductions",
    category: "refund_deposit",
    severity: "high",
    pattern: /deduct(?:ed|ion)? from (?:the )?(?:security )?deposit|forfeit(?:ed)? (?:the )?deposit/i,
    whyTemplate: "The landlord or vendor can deduct expenses from your deposit at their own judgment.",
    actionTemplate: "Insist on joint inspection and receipt-backed deductions before move-out.",
  },
  {
    id: "R12",
    name: "Rent / Price Escalation",
    category: "hidden_charges",
    severity: "medium",
    pattern: /escalat|increase[sd]? by \d+ ?%/i,
    whyTemplate: "Charges increase automatically upon renewal or tenure extension.",
    actionTemplate: "Confirm the exact escalation percentage and renewal date in writing.",
  },
  {
    id: "R13",
    name: "Awkward Cancellation Procedure",
    category: "lock_in_termination",
    severity: "high",
    pattern: /registered post|speed post|in writing only|in person/i,
    whyTemplate: "Cancelling requires cumbersome physical mail or in-person visits rather than online clicks.",
    actionTemplate: "Check postal transit times and send cancellation notice well in advance.",
  },
  {
    id: "R14",
    name: "Hidden / Extra Charges",
    category: "hidden_charges",
    severity: "low",
    pattern: /processing fee|administrative fee|convenience fee|documentation charges/i,
    whyTemplate: "Additional non-core administrative fees are added to your upfront or monthly bill.",
    actionTemplate: "Ask for a complete breakdown of all non-refundable ancillary charges.",
  },
  {
    id: "R15",
    name: "Non-Compete / IP Assignment",
    category: "non_compete_ip",
    severity: "medium",
    pattern: /non[- ]?compete|restrictive covenant|assigns? all (?:rights|intellectual)/i,
    whyTemplate: "Restricts your ability to work or claims ownership of intellectual creations.",
    actionTemplate: "Check geographical and time limits to ensure they comply with local laws.",
  },
  {
    id: "R16",
    name: "Exclusion / Waiting Period",
    category: "exclusion_coverage",
    severity: "medium",
    pattern: /exclusion|not covered|waiting period|pre-existing|co-?payment|sub-?limit/i,
    whyTemplate: "Specific conditions or incidents are excluded from coverage or require waiting periods.",
    actionTemplate: "Review the exclusions list carefully against your personal requirements.",
  },
];

/**
 * Extracts a complete sentence containing the match to serve as an exact quote.
 */
function extractSentenceAroundMatch(text: string, matchIndex: number): string {
  // Find start of sentence (or beginning of clause)
  const prevPeriod = Math.max(
    text.lastIndexOf(". ", matchIndex),
    text.lastIndexOf(".\n", matchIndex),
    text.lastIndexOf("?\n", matchIndex),
    text.lastIndexOf("!\n", matchIndex)
  );
  const sentenceStart = prevPeriod === -1 ? 0 : prevPeriod + 2;

  // Find end of sentence
  const nextPeriod = text.indexOf(". ", matchIndex);
  const nextNewline = text.indexOf("\n", matchIndex);
  let sentenceEnd = text.length;

  if (nextPeriod !== -1 && nextNewline !== -1) {
    sentenceEnd = Math.min(nextPeriod + 1, nextNewline);
  } else if (nextPeriod !== -1) {
    sentenceEnd = nextPeriod + 1;
  } else if (nextNewline !== -1) {
    sentenceEnd = nextNewline;
  }

  const sentence = text.slice(sentenceStart, sentenceEnd).trim();
  if (sentence.length >= 20 && sentence.length <= 400) {
    return sentence;
  }

  // Fallback: take a 20-300 char slice around matchIndex
  const safeStart = Math.max(0, matchIndex - 20);
  const safeEnd = Math.min(text.length, matchIndex + 180);
  return text.slice(safeStart, safeEnd).trim();
}

/**
 * Executes all 16 rules across the segmented clauses.
 * Returns candidate traps and hints for the LLM.
 */
export function runRuleEngine(clauses: Clause[]): {
  traps: z.infer<typeof Trap>[];
  hints: Array<{ clauseId: string; category: CategoryType }>;
} {
  const traps: z.infer<typeof Trap>[] = [];
  const hints: Array<{ clauseId: string; category: CategoryType }> = [];
  const seenCombinations = new Set<string>();

  for (const clause of clauses) {
    for (const rule of CONTRACT_RULES) {
      const match = rule.pattern.exec(clause.text);
      if (match) {
        const comboKey = `${clause.id}:${rule.category}`;
        if (!seenCombinations.has(comboKey)) {
          seenCombinations.add(comboKey);
          hints.push({ clauseId: clause.id, category: rule.category });

          const quote = extractSentenceAroundMatch(clause.text, match.index);
          if (quote.length >= 20) {
            traps.push({
              clauseId: clause.id,
              quote,
              category: rule.category,
              severity: rule.severity,
              why: rule.whyTemplate,
              action: rule.actionTemplate,
            });
          }
        }
      }
    }
  }

  return { traps, hints };
}
