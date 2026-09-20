import { describe, it, expect } from "vitest";
import { segmentDocument, normalizeLineEndings, formatClausesForPrompt } from "../lib/segment";
import * as fs from "fs";
import * as path from "path";

describe("Clause Segmentation (lib/segment.ts)", () => {
  it("handles empty and whitespace strings", () => {
    expect(segmentDocument("")).toEqual([]);
  });

  it("handles a single short clause", () => {
    const text = "This is a single short sentence agreement.";
    const clauses = segmentDocument(text);
    expect(clauses).toHaveLength(1);
    expect(clauses[0].id).toBe("C1");
    expect(clauses[0].start).toBe(0);
    expect(clauses[0].end).toBe(text.length);
    expect(clauses[0].text).toBe(text);
  });

  const testCoverageInvariant = (docName: string, rawText: string) => {
    const normalized = normalizeLineEndings(rawText);
    const clauses = segmentDocument(rawText);

    expect(clauses.length).toBeGreaterThan(0);
    expect(clauses[0].start).toBe(0);
    expect(clauses[clauses.length - 1].end).toBe(normalized.length);

    // Verify each clause text matches exact slice
    for (let i = 0; i < clauses.length; i++) {
      const c = clauses[i];
      expect(c.id).toBe(`C${i + 1}`);
      expect(c.text).toBe(normalized.slice(c.start, c.end));
      if (i < clauses.length - 1) {
        // No gaps, no overlaps
        expect(c.end).toBe(clauses[i + 1].start);
      }
    }

    // Full text reassembly invariant
    const reassembled = clauses.map((c) => c.text).join("");
    expect(reassembled).toBe(normalized);
  };

  it("maintains the coverage invariant for synthetic contract", () => {
    const contract = `
TITLE OF AGREEMENT

1. First Clause
This is the first clause with some detailed text describing duties.

2. Second Clause
This is the second clause outlining penalties and liabilities.

3. Third Clause
Final stipulations and signature terms.
    `.trim();

    testCoverageInvariant("synthetic", contract);
  });

  it("maintains the coverage invariant for gym-membership sample", () => {
    const samplePath = path.join(__dirname, "../samples/gym-membership.txt");
    const raw = fs.readFileSync(samplePath, "utf-8");
    testCoverageInvariant("gym-membership", raw);
  });

  it("maintains the coverage invariant for rental-agreement sample", () => {
    const samplePath = path.join(__dirname, "../samples/rental-agreement.txt");
    const raw = fs.readFileSync(samplePath, "utf-8");
    testCoverageInvariant("rental-agreement", raw);
  });

  it("maintains the coverage invariant for personal-loan sample", () => {
    const samplePath = path.join(__dirname, "../samples/personal-loan.txt");
    const raw = fs.readFileSync(samplePath, "utf-8");
    testCoverageInvariant("personal-loan", raw);
  });

  it("formats clauses for prompts with [C#] tags", () => {
    const sample = "1. First clause with sufficient text to exceed forty characters threshold.\n\n2. Second clause with sufficient text to exceed forty characters threshold.";
    const clauses = segmentDocument(sample);
    const promptText = formatClausesForPrompt(clauses);
    expect(promptText).toContain("[C1]");
    expect(promptText).toContain("[C2]");
  });
});
