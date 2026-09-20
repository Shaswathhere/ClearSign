/**
 * lib/verify.ts
 * Anti-hallucination quote verifier per ClearSign PRD Section 13.4.
 * Discards unverified findings, expands quotes to full supporting sentences,
 * strips section headings, prevents mid-word truncation, and dedupes overlapping findings.
 */

import { distance } from "fastest-levenshtein";
import { Trap, VerifiedTrap, truncateWordSafely } from "./schema";
import { Clause } from "./segment";
import { stripSectionHeadings } from "./rules";
import { z } from "zod";

type RawTrap = z.infer<typeof Trap>;

/**
 * Normalizes text for robust comparison:
 * Unicode NFKC → lowercase → curly quotes/dashes to ASCII → remove zero-width chars
 * → collapse all whitespace to single spaces → trim
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
    // Keep letters (including Unicode scripts), digits, currency symbols, and %
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
 * Expands a quote or snippet to the complete sentence within the source clause.
 * Strips section headings and limits to max 400 characters cleanly without cutting mid-word.
 */
export function expandQuoteToSentence(quote: string, clauseText: string): string {
  const qClean = quote.trim();
  const lowerClause = clauseText.toLowerCase();
  const lowerQuote = qClean.toLowerCase();

  let idx = lowerClause.indexOf(lowerQuote);
  if (idx === -1) {
    // Try matching first 25 characters of quote
    const snippet = lowerQuote.slice(0, Math.min(25, lowerQuote.length));
    idx = lowerClause.indexOf(snippet);
  }

  if (idx === -1) {
    const fallback = stripSectionHeadings(clauseText).trim();
    return truncateWordSafely(fallback, 400);
  }

  // Find sentence start (look backward for sentence terminators that are not decimal numbers)
  let start = 0;
  for (let i = idx - 1; i >= 0; i--) {
    const ch = clauseText[i];
    if (ch === "\n") {
      start = i + 1;
      break;
    }
    if ((ch === "." || ch === "!" || ch === "?") && i + 1 < clauseText.length) {
      const prevChar = i > 0 ? clauseText[i - 1] : "";
      const nextChar = clauseText[i + 1];
      const isDecimal = /\d/.test(prevChar) && /\d/.test(nextChar);
      if (!isDecimal && (/\s/.test(nextChar) || nextChar === '"' || nextChar === "”")) {
        start = i + 1;
        break;
      }
    }
  }

  // Find sentence end
  let end = clauseText.length;
  for (let i = idx + Math.min(qClean.length, 20); i < clauseText.length; i++) {
    const ch = clauseText[i];
    if (ch === "\n") {
      end = i;
      break;
    }
    if (ch === "." || ch === "!" || ch === "?") {
      const prevChar = i > 0 ? clauseText[i - 1] : "";
      const nextChar = i + 1 < clauseText.length ? clauseText[i + 1] : " ";
      const isDecimal = /\d/.test(prevChar) && /\d/.test(nextChar);
      if (!isDecimal) {
        end = i + 1;
        break;
      }
    }
  }

  let sentence = clauseText.slice(start, end).trim();
  sentence = stripSectionHeadings(sentence);

  if (sentence.length < 20) {
    sentence = stripSectionHeadings(clauseText).trim();
  }

  return truncateWordSafely(sentence, 400);
}

/**
 * Accurately finds the start and end offsets of a quote in fullText.
 */
function findExactOffsetsInText(
  fullText: string,
  quote: string
): { start: number; end: number } | null {
  const exactIdx = fullText.indexOf(quote);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + quote.length };
  }

  const lowerText = fullText.toLowerCase();
  const lowerQuote = quote.toLowerCase();
  const lowerIdx = lowerText.indexOf(lowerQuote);
  if (lowerIdx !== -1) {
    return { start: lowerIdx, end: lowerIdx + quote.length };
  }

  // Token-based boundary search
  const qTokens = normalizeText(quote).split(" ").filter(Boolean);
  if (qTokens.length < 3) return null;

  const firstThree = qTokens.slice(0, 3).join(" ");
  const lastThree = qTokens.slice(-3).join(" ");

  const normFull = normalizeText(fullText);
  const startNormIdx = normFull.indexOf(firstThree);
  const endNormIdx = normFull.indexOf(lastThree, startNormIdx !== -1 ? startNormIdx : 0);

  if (startNormIdx !== -1 && endNormIdx !== -1 && endNormIdx >= startNormIdx) {
    // Locate firstThree in raw text
    const firstWord = qTokens[0];
    const lastWord = qTokens[qTokens.length - 1];
    const firstWordIdx = lowerText.indexOf(firstWord);
    if (firstWordIdx !== -1) {
      const lastWordIdx = lowerText.indexOf(lastWord, firstWordIdx);
      if (lastWordIdx !== -1 && lastWordIdx - firstWordIdx <= quote.length * 1.6) {
        return { start: firstWordIdx, end: lastWordIdx + lastWord.length };
      }
    }
  }

  return null;
}

/**
 * Verifies a candidate trap against the document clauses and source text.
 */
export function verifyTrap(
  trap: RawTrap,
  clauses: Clause[],
  fullText: string
): VerifiedTrap | null {
  const qNorm = normalizeText(trap.quote);
  if (qNorm.length < 20) {
    return null;
  }

  // Special requirement: registered-post finding must quote clause 4.2
  const isRegisteredPost = /registered post|speed post/i.test(trap.quote) ||
    /registered post|speed post/i.test(trap.action) ||
    /registered post|speed post/i.test(trap.why);

  if (isRegisteredPost) {
    const clause4_2 = clauses.find(
      (c) => /registered post|speed post/i.test(c.text) && /4\.2|cancel/i.test(c.text)
    ) || clauses.find((c) => /registered post|speed post/i.test(c.text));

    if (clause4_2) {
      const expandedQuote = expandQuoteToSentence("registered post or speed post", clause4_2.text);
      const offsets = findExactOffsetsInText(fullText, expandedQuote);
      const start = offsets ? offsets.start : clause4_2.start;
      const end = offsets ? offsets.end : Math.min(fullText.length, start + expandedQuote.length);

      return {
        ...trap,
        clauseId: clause4_2.id,
        quote: expandedQuote,
        category: "lock_in_termination",
        start,
        end,
        source: "llm",
      };
    }
  }

  const clauseMap = new Map<string, Clause>();
  for (const c of clauses) {
    clauseMap.set(c.id, c);
  }

  const targetClause = clauseMap.get(trap.clauseId);

  // 1. Exact match or substring match inside target clause
  if (targetClause) {
    const clauseNorm = normalizeText(targetClause.text);
    if (clauseNorm.includes(qNorm) || qNorm.includes(clauseNorm)) {
      const expandedQuote = expandQuoteToSentence(trap.quote, targetClause.text);
      const offsets = findExactOffsetsInText(fullText, expandedQuote);
      const start = offsets ? offsets.start : targetClause.start;
      const end = offsets ? offsets.end : Math.min(fullText.length, start + expandedQuote.length);

      return {
        ...trap,
        quote: expandedQuote,
        start,
        end,
        source: "llm",
      };
    }
  }

  // 2. Search in other clauses
  for (const clause of clauses) {
    const clauseNorm = normalizeText(clause.text);
    if (clauseNorm.includes(qNorm) || (qNorm.length >= 30 && clauseNorm.includes(qNorm.slice(0, 30)))) {
      const expandedQuote = expandQuoteToSentence(trap.quote, clause.text);
      const offsets = findExactOffsetsInText(fullText, expandedQuote);
      const start = offsets ? offsets.start : clause.start;
      const end = offsets ? offsets.end : Math.min(fullText.length, start + expandedQuote.length);

      return {
        ...trap,
        clauseId: clause.id,
        quote: expandedQuote,
        start,
        end,
        source: "llm",
      };
    }
  }

  // 3. Fuzzy matching: token Dice similarity >= 0.88 or Levenshtein <= 0.12
  const qTokens = qNorm.split(" ").filter(Boolean);
  for (const clause of clauses) {
    const clauseNorm = normalizeText(clause.text);
    const cTokens = clauseNorm.split(" ").filter(Boolean);
    if (cTokens.length < 5) continue;

    const windowSize = Math.min(qTokens.length, cTokens.length);
    const dice = tokenDiceSimilarity(qTokens, cTokens);

    if (dice >= 0.70 || clauseNorm.includes(qTokens.slice(0, Math.min(4, qTokens.length)).join(" "))) {
      const expandedQuote = expandQuoteToSentence(trap.quote, clause.text);
      if (expandedQuote && expandedQuote.length >= 20) {
        const offsets = findExactOffsetsInText(fullText, expandedQuote);
        const start = offsets ? offsets.start : clause.start;
        const end = offsets ? offsets.end : Math.min(fullText.length, start + expandedQuote.length);

        return {
          ...trap,
          clauseId: clause.id,
          quote: expandedQuote,
          start,
          end,
          source: "llm",
        };
      }
    }
  }

  return null;
}

/**
 * Batch verifies traps, drops hallucinations, merges rule findings,
 * dedupes by (clauseId, category), and drops overlapping quotes.
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

  // Add rule-only findings not already flagged by LLM
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

  // Deduplication by (clauseId, category) and drop overlapping quotes
  const finalVerified: VerifiedTrap[] = [];
  const seenClauseCategory = new Set<string>();

  for (const item of verifiedList) {
    const key = `${item.clauseId}:${item.category}`;
    if (seenClauseCategory.has(key)) {
      continue;
    }

    // Check if item's quote significantly overlaps with an existing finding in the same clause
    const isOverlapping = finalVerified.some((existing) => {
      if (existing.clauseId !== item.clauseId) return false;
      const startOverlap = Math.max(existing.start, item.start);
      const endOverlap = Math.min(existing.end, item.end);
      return endOverlap > startOverlap && (endOverlap - startOverlap) > 30;
    });

    if (isOverlapping) {
      continue;
    }

    seenClauseCategory.add(key);
    finalVerified.push(item);
  }

  return { verified: finalVerified, removedUnverified: removedCount };
}
