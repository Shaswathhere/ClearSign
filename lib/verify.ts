/**
 * lib/verify.ts
 * Anti-hallucination quote verifier per ClearSign PRD Section 13.4.
 * Discards unverified findings and replaces LLM quotes with exact source substrings and offsets.
 */

import { distance } from "fastest-levenshtein";
import { Trap, VerifiedTrap } from "./schema";
import { Clause } from "./segment";
import { z } from "zod";

type RawTrap = z.infer<typeof Trap>;

/**
 * Normalizes text for robust comparison:
 * Unicode NFKC → lowercase → curly quotes/dashes to ASCII → remove zero-width chars
 * → collapse all whitespace to single spaces → trim
 * (keeps letters, digits, currency symbols and % ; drops other punctuation)
 */
export function normalizeText(s: string): string {
  if (!s) return "";
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, "-")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    // Keep letters (including Unicode scripts like Hindi/Tamil), digits, currency symbols, and %
    .replace(/[^\p{L}\p{N}₹$€£¥%\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Computes token-level Dice similarity between two token arrays.
 */
function tokenDiceSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 && tokensB.length === 0) return 1.0;
  if (tokensA.length === 0 || tokensB.length === 0) return 0.0;

  const countB = new Map<string, number>();
  for (const t of tokensB) {
    countB.set(t, (countB.get(t) || 0) + 1);
  }

  let intersection = 0;
  for (const t of tokensA) {
    const bCount = countB.get(t) || 0;
    if (bCount > 0) {
      intersection++;
      countB.set(t, bCount - 1);
    }
  }

  return (2 * intersection) / (tokensA.length + tokensB.length);
}

/**
 * Attempts to locate the exact character start and end in rawText
 * that corresponds to a matched substring.
 */
function locateSourceSpan(
  rawText: string,
  targetNorm: string
): { start: number; end: number; exactText: string } | null {
  const normRaw = normalizeText(rawText);
  const normIndex = normRaw.indexOf(targetNorm);

  if (normIndex === -1) {
    return null;
  }

  // To find accurate raw offsets, we can match key anchor words
  const normTokens = targetNorm.split(" ").filter(Boolean);
  if (normTokens.length === 0) return null;

  const firstToken = normTokens[0];
  const lastToken = normTokens[normTokens.length - 1];

  // Search for occurrence of firstToken in rawText around expected position
  const firstWordRegex = new RegExp(`\\b${firstToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  const lastWordRegex = new RegExp(`\\b${lastToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");

  const firstMatch = firstWordRegex.exec(rawText);
  if (firstMatch) {
    const start = firstMatch.index;
    lastWordRegex.lastIndex = start;
    let match: RegExpExecArray | null;
    let end = -1;

    // Find the closest lastToken that roughly matches the character length
    const approxLen = targetNorm.length;
    while ((match = lastWordRegex.exec(rawText)) !== null) {
      const curEnd = match.index + match[0].length;
      if (curEnd - start >= approxLen * 0.7 && curEnd - start <= approxLen * 1.5) {
        end = curEnd;
        break;
      }
    }

    if (end > start) {
      return {
        start,
        end,
        exactText: rawText.slice(start, end).trim(),
      };
    }
  }

  // Fallback direct scan
  const startApprox = Math.max(0, Math.floor((normIndex / normRaw.length) * rawText.length));
  const endApprox = Math.min(rawText.length, startApprox + targetNorm.length);
  return {
    start: startApprox,
    end: endApprox,
    exactText: rawText.slice(startApprox, endApprox).trim(),
  };
}

/**
 * Verifies a candidate trap against the document clauses and source text.
 * 
 * Success conditions:
 * 1. Exact match within target clause
 * 2. Exact match in global full text (updates clauseId)
 * 3. Fuzzy match within clause or full text (token Dice >= 0.92 or Levenshtein <= 0.08)
 * 
 * On success: Replaces trap.quote with the source substring, sets start/end offsets.
 * On failure: Returns null.
 */
export function verifyTrap(
  trap: RawTrap,
  clauses: Clause[],
  fullText: string
): VerifiedTrap | null {
  const qNorm = normalizeText(trap.quote);

  // Reject quotes shorter than 20 characters
  if (qNorm.length < 20) {
    return null;
  }

  const clauseMap = new Map<string, Clause>();
  for (const c of clauses) {
    clauseMap.set(c.id, c);
  }

  const targetClause = clauseMap.get(trap.clauseId);

  // 1. Exact match inside target clause
  if (targetClause) {
    const clauseNorm = normalizeText(targetClause.text);
    if (clauseNorm.includes(qNorm)) {
      const span = locateSourceSpan(targetClause.text, qNorm);
      const start = span ? targetClause.start + span.start : targetClause.start;
      const end = span ? targetClause.start + span.end : targetClause.end;
      const exactQuote = span ? span.exactText : fullText.slice(start, end);

      return {
        ...trap,
        quote: exactQuote.length >= 20 ? exactQuote : trap.quote,
        start,
        end,
        source: "llm",
      };
    }
  }

  // 2. Exact match in global full text (correct clauseId if found in different clause)
  const fullNorm = normalizeText(fullText);
  if (fullNorm.includes(qNorm)) {
    const span = locateSourceSpan(fullText, qNorm);
    const start = span ? span.start : 0;
    const end = span ? span.end : fullText.length;
    const exactQuote = span ? span.exactText : fullText.slice(start, end);

    // Identify which clause contains the start index
    const correctClause = clauses.find((c) => start >= c.start && start < c.end) || targetClause;

    return {
      ...trap,
      clauseId: correctClause ? correctClause.id : trap.clauseId,
      quote: exactQuote.length >= 20 ? exactQuote : trap.quote,
      start,
      end,
      source: "llm",
    };
  }

  // 3. Fuzzy matching: slide token window over target clause then full text
  const qTokens = qNorm.split(" ").filter(Boolean);
  const searchClauses = targetClause ? [targetClause, ...clauses.filter((c) => c.id !== targetClause.id)] : clauses;

  for (const clause of searchClauses) {
    const clauseNorm = normalizeText(clause.text);
    const cTokens = clauseNorm.split(" ").filter(Boolean);

    if (cTokens.length < qTokens.length * 0.7) {
      continue;
    }

    const windowSize = qTokens.length;
    const minWindow = Math.max(1, Math.floor(windowSize * 0.9));
    const maxWindow = Math.ceil(windowSize * 1.1);

    for (let w = minWindow; w <= maxWindow; w++) {
      for (let i = 0; i <= cTokens.length - w; i++) {
        const windowTokens = cTokens.slice(i, i + w);
        const windowStr = windowTokens.join(" ");
        const maxLen = Math.max(qNorm.length, windowStr.length);
        const levDist = distance(qNorm, windowStr);
        const levRatio = maxLen > 0 ? levDist / maxLen : 1;
        const dice = tokenDiceSimilarity(qTokens, windowTokens);

        if (levRatio <= 0.08 || dice >= 0.92) {
          const span = locateSourceSpan(clause.text, windowStr);
          const start = span ? clause.start + span.start : clause.start;
          const end = span ? clause.start + span.end : clause.end;
          const exactQuote = span ? span.exactText : fullText.slice(start, end);

          return {
            ...trap,
            clauseId: clause.id,
            quote: exactQuote.length >= 20 ? exactQuote : trap.quote,
            start,
            end,
            source: "llm",
          };
        }
      }
    }
  }

  // 4. Otherwise reject
  return null;
}

/**
 * Batch verifies traps, drops hallucinations, merges rule findings,
 * and tracks removedUnverified count.
 */
export function verifyAllFindings(
  llmTraps: RawTrap[],
  ruleTraps: RawTrap[],
  clauses: Clause[],
  fullText: string
): { verified: VerifiedTrap[]; removedUnverified: number } {
  const verifiedList: VerifiedTrap[] = [];
  let removedCount = 0;

  // Process LLM candidate traps
  for (const trap of llmTraps) {
    const res = verifyTrap(trap, clauses, fullText);
    if (res) {
      // Check if rule engine also flagged this clause/category
      const matchedRule = ruleTraps.find(
        (r) => r.clauseId === res.clauseId && r.category === res.category
      );
      verifiedList.push({
        ...res,
        source: matchedRule ? "both" : "llm",
      });
    } else {
      removedCount++;
    }
  }

  // Add rule-only findings that were not already flagged by LLM
  for (const ruleTrap of ruleTraps) {
    const alreadyCovered = verifiedList.some(
      (v) => v.clauseId === ruleTrap.clauseId && v.category === ruleTrap.category
    );

    if (!alreadyCovered) {
      const res = verifyTrap(ruleTrap, clauses, fullText);
      if (res) {
        verifiedList.push({
          ...res,
          source: "rule",
        });
      }
    }
  }

  return { verified: verifiedList, removedUnverified: removedCount };
}
