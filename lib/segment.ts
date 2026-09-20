/**
 * lib/segment.ts
 * Deterministic clause segmentation with stable IDs and character offsets.
 * Guarantees that every character in the document belongs to exactly one clause.
 */

export interface Clause {
  id: string;      // e.g. "C1", "C2"
  start: number;   // Character start offset (inclusive)
  end: number;     // Character end offset (exclusive)
  text: string;    // Raw clause text exactly matching source[start:end]
}

/**
 * Normalizes line endings to \n so indexing is uniform across platforms.
 */
export function normalizeLineEndings(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Splits document text into contiguous clauses.
 * 
 * Rules:
 * 1. Line endings normalized to \n.
 * 2. Boundary detection looks for numbered headings (1., 1.1, (a), Clause 7, Article 3) or blank lines.
 * 3. Short fragments (<40 chars) are merged into the preceding clause.
 * 4. Excessively long clauses (>1200 chars) are split at sentence boundaries if possible.
 * 5. Coverage invariant: clauses cover the entire text with 0 gaps and 0 overlaps:
 *    clauses.map(c => c.text).join("") === normalizedText
 */
export function segmentDocument(rawText: string): Clause[] {
  const text = normalizeLineEndings(rawText);
  if (!text || text.length === 0) {
    return [];
  }

  // Regex pattern matching start of potential new clauses/sections
  // Matches:
  // - Double newlines: \n\s*\n
  // - Headings: \n(?=(?:[0-9]+[\.\)]|\([a-zA-Z0-9]+\)|(?:Clause|Article|Section)\s+[0-9A-Za-z]+)\s+)
  // - All caps titles on a new line
  const headingPattern = /(?:\n\s*\n|\n(?=(?:[0-9]+[.)]|\([a-zA-Z0-9]+\)|(?:Clause|Article|Section|Schedule)\s+[0-9A-Za-z]+|[A-Z\s]{4,}:?\n)))/gi;

  const splitPoints = new Set<number>([0, text.length]);
  let match: RegExpExecArray | null;

  while ((match = headingPattern.exec(text)) !== null) {
    // If the match is a newline sequence, split at the end of the whitespace separator
    // or right before the heading
    const splitIndex = match.index === 0 ? 0 : match.index;
    if (splitIndex > 0 && splitIndex < text.length) {
      splitPoints.add(splitIndex);
    }
  }

  // Convert sorted unique split points into initial slices
  const sortedPoints = Array.from(splitPoints).sort((a, b) => a - b);
  const rawSlices: { start: number; end: number }[] = [];

  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const start = sortedPoints[i];
    const end = sortedPoints[i + 1];
    if (end > start) {
      rawSlices.push({ start, end });
    }
  }

  if (rawSlices.length === 0) {
    return [{ id: "C1", start: 0, end: text.length, text }];
  }

  // Pass 1: Merge short fragments (<40 chars) into previous slice to avoid tiny stray clauses
  const mergedSlices: { start: number; end: number }[] = [];
  for (let i = 0; i < rawSlices.length; i++) {
    const current = rawSlices[i];
    const sliceLen = current.end - current.start;

    if (sliceLen < 40 && mergedSlices.length > 0) {
      // Merge into previous slice by extending its end
      mergedSlices[mergedSlices.length - 1].end = current.end;
    } else {
      mergedSlices.push({ ...current });
    }
  }

  // Pass 2: Split slices over ~1200 characters at sentence boundaries (. ! ? followed by space/newline)
  const finalSlices: { start: number; end: number }[] = [];
  const MAX_CLAUSE_LEN = 1200;

  for (const slice of mergedSlices) {
    let curStart = slice.start;
    const sliceEnd = slice.end;

    while (sliceEnd - curStart > MAX_CLAUSE_LEN) {
      const windowEnd = Math.min(curStart + MAX_CLAUSE_LEN, sliceEnd);
      const sub = text.slice(curStart, windowEnd);
      
      // Look for a sentence boundary within the last 400 characters of the window
      const searchSub = sub.slice(Math.max(0, sub.length - 400));
      const sentenceMatch = searchSub.search(/[\.\!\?]\s+[A-Z0-9]/);

      let breakOffset: number;
      if (sentenceMatch !== -1) {
        // Break after the punctuation mark + space
        breakOffset = Math.max(0, sub.length - 400) + sentenceMatch + 2;
      } else {
        // Fallback to last newline or space
        const lastSpace = sub.lastIndexOf(" ");
        breakOffset = lastSpace > 400 ? lastSpace + 1 : windowEnd - curStart;
      }

      const curEnd = curStart + breakOffset;
      finalSlices.push({ start: curStart, end: curEnd });
      curStart = curEnd;
    }

    if (curStart < sliceEnd) {
      finalSlices.push({ start: curStart, end: sliceEnd });
    }
  }

  // Format into final Clause objects with IDs C1, C2, ...
  return finalSlices.map((slice, index) => ({
    id: `C${index + 1}`,
    start: slice.start,
    end: slice.end,
    text: text.slice(slice.start, slice.end),
  }));
}

/**
 * Formats segmented clauses for LLM prompts as "[C1] clause text\n[C2] clause text..."
 */
export function formatClausesForPrompt(clauses: Clause[]): string {
  return clauses.map((c) => `[${c.id}] ${c.text.trim()}`).join("\n\n");
}
