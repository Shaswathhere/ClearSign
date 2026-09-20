/**
 * scripts/eval.ts
 * Evaluates the ClearSign pipeline against the planted traps in samples/golden.json.
 * Computes and prints:
 * - Recall of planted traps (%)
 * - Extra findings count
 * - Definition-clause false positives count
 * - Truncated quotes count
 * - Removed unverified count (anti-hallucination metric)
 * - End-to-end latency (ms)
 * 
 * Usage: node node_modules/tsx/dist/cli.mjs scripts/eval.ts
 */

import * as fs from "fs";
import * as path from "path";
import { segmentDocument, formatClausesForPrompt } from "../lib/segment";
import { runRuleEngine } from "../lib/rules";
import { verifyAllFindings, normalizeText } from "../lib/verify";
import { calculateRiskScore } from "../lib/score";
import { callLLMJson } from "../lib/llm";
import { SYSTEM_ANALYSIS_PROMPT, buildUserAnalysisPrompt } from "../lib/prompts";
import { Analysis } from "../lib/schema";

interface PlantedTrap {
  clause?: string;
  category: string;
  severity: string;
  quoteSnippet: string;
}

interface SampleMeta {
  id: string;
  name: string;
  file: string;
  docType: string;
  plantedTraps: PlantedTrap[];
}

interface GoldenConfig {
  samples: SampleMeta[];
}

function isMatchingTrap(
  v: { category: string; quote: string },
  planted: PlantedTrap
): boolean {
  const vNorm = normalizeText(v.quote);
  const pNorm = normalizeText(planted.quoteSnippet);

  // Quote match: contains or overlaps
  const pSnippetShort = pNorm.slice(0, Math.min(30, pNorm.length));
  const quoteMatches =
    vNorm.includes(pNorm) ||
    pNorm.includes(vNorm) ||
    vNorm.includes(pSnippetShort) ||
    pNorm.includes(vNorm.slice(0, Math.min(30, vNorm.length)));

  if (!quoteMatches) return false;

  if (v.category === planted.category) return true;

  // Compatible legal categories across different taxonomies
  const compatiblePairs = new Set([
    "unilateral_change:lock_in_termination",
    "lock_in_termination:unilateral_change",
    "unilateral_change:refund_deposit",
    "refund_deposit:unilateral_change",
    "unilateral_change:hidden_charges",
    "hidden_charges:unilateral_change",
    "penalty_fee:lock_in_termination",
    "lock_in_termination:penalty_fee",
    "penalty_fee:hidden_charges",
    "hidden_charges:penalty_fee",
    "penalty_fee:refund_deposit",
    "refund_deposit:penalty_fee",
    "exclusion_coverage:liability_indemnity",
    "liability_indemnity:exclusion_coverage",
    "exclusion_coverage:vague_terms",
    "vague_terms:exclusion_coverage",
    "exclusion_coverage:lock_in_termination",
    "lock_in_termination:exclusion_coverage",
  ]);

  return compatiblePairs.has(`${v.category}:${planted.category}`);
}

async function runEvaluation() {
  // Load .env.local if present
  const envLocalPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, "utf-8");
    for (const line of envContent.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
        const idx = trimmed.indexOf("=");
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }

  const goldenPath = path.join(process.cwd(), "samples", "golden.json");
  if (!fs.existsSync(goldenPath)) {
    console.error("samples/golden.json not found!");
    process.exit(1);
  }

  const goldenConfig: GoldenConfig = JSON.parse(fs.readFileSync(goldenPath, "utf-8"));
  const hasKey = Boolean(process.env.LLM_API_KEY);

  console.log("\n=======================================================");
  console.log("  ClearSign Pipeline Evaluation (scripts/eval.ts)");
  console.log(`  LLM Engine: ${hasKey ? `Groq (${process.env.LLM_MODEL || "qwen/qwen3.8-27b"})` : "Rules-only fallback (LLM_API_KEY unset)"}`);
  console.log("=======================================================\n");

  const results: Array<{
    name: string;
    plantedTotal: number;
    plantedFound: number;
    recallPct: number;
    extraFindings: number;
    definitionFPs: number;
    truncatedQuotes: number;
    removedUnverified: number;
    score: number;
    band: string;
    latencyMs: number;
  }> = [];

  for (const sample of goldenConfig.samples) {
    const docPath = path.join(process.cwd(), sample.file);
    if (!fs.existsSync(docPath)) {
      console.warn(`File not found: ${sample.file}`);
      continue;
    }

    const rawText = fs.readFileSync(docPath, "utf-8");
    const startTime = Date.now();

    // 1. Clause segmentation
    const clauses = segmentDocument(rawText);

    // 2. Rule engine
    const { traps: ruleTraps, hints: ruleHints } = runRuleEngine(clauses);

    // 3. LLM analysis
    let llmTraps: Analysis["traps"] = [];
    if (hasKey) {
      try {
        const formatted = formatClausesForPrompt(clauses);
        const userPrompt = buildUserAnalysisPrompt(formatted, ruleHints, sample.docType);

        const llmResult = await callLLMJson<Analysis>(
          SYSTEM_ANALYSIS_PROMPT,
          userPrompt,
          (raw) => {
            const parsed = Analysis.safeParse(raw);
            if (!parsed.success) return { success: false, error: parsed.error.format() };
            return { success: true, data: parsed.data };
          }
        );
        llmTraps = llmResult.traps;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  [${sample.id}] LLM call error: ${msg}. Using rule-only findings.`);
      }
    }

    // 4. Verification layer
    const { verified, removedUnverified } = verifyAllFindings(
      llmTraps,
      ruleTraps,
      clauses,
      rawText
    );

    // 5. Scoring
    const { score, band } = calculateRiskScore(verified);
    const latencyMs = Date.now() - startTime;

    // 6. Check quality metrics
    // A. Definition false positives: check if any trap quotes definition clause (1.1 / "means the Initial Term")
    let definitionFPs = 0;
    for (const v of verified) {
      const clause = clauses.find((c) => c.id === v.clauseId);
      if (clause && (/^1\.1\b/i.test(clause.text.trim()) || /\bmeans the Initial Term\b/i.test(clause.text))) {
        definitionFPs++;
      }
    }

    // B. Truncated quotes check: check if any quote ends mid-word (alphanumeric character without trailing word/punct)
    let truncatedQuotes = 0;
    for (const v of verified) {
      // If quote cuts in the middle of a word: check if the exact quote in source text continues with more letters
      const q = v.quote.trim();
      const rawIdx = rawText.indexOf(q);
      if (rawIdx !== -1 && rawIdx + q.length < rawText.length) {
        const nextChar = rawText[rawIdx + q.length];
        const lastChar = q[q.length - 1];
        if (/[a-zA-Z]/.test(lastChar) && /[a-zA-Z]/.test(nextChar)) {
          truncatedQuotes++;
        }
      }
    }

    // 7. Match against planted traps
    let matchedPlantedCount = 0;
    const matchedVerifiedIndices = new Set<number>();

    for (const planted of sample.plantedTraps) {
      let found = false;
      for (let i = 0; i < verified.length; i++) {
        const v = verified[i];
        if (isMatchingTrap(v, planted)) {
          found = true;
          matchedVerifiedIndices.add(i);
          break;
        }
      }

      if (found) {
        matchedPlantedCount++;
      }
    }

    const plantedTotal = sample.plantedTraps.length;
    const recallPct = plantedTotal > 0 ? Math.round((matchedPlantedCount / plantedTotal) * 100) : 100;
    const extraFindings = Math.max(0, verified.length - matchedVerifiedIndices.size);

    results.push({
      name: sample.name,
      plantedTotal,
      plantedFound: matchedPlantedCount,
      recallPct,
      extraFindings,
      definitionFPs,
      truncatedQuotes,
      removedUnverified,
      score,
      band,
      latencyMs,
    });
  }

  // Print results table
  console.log("| Document | Planted Traps | Recalled | Recall % | Extra Findings | Definition FPs | Truncated Quotes | Score / Band | Latency |");
  console.log("|---|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    console.log(
      `| **${r.name}** | ${r.plantedTotal} | ${r.plantedFound} | **${r.recallPct}%** | ${r.extraFindings} | **${r.definitionFPs}** | **${r.truncatedQuotes}** | ${r.score}/100 (${r.band}) | ${r.latencyMs} ms |`
    );
  }

  const avgRecall = Math.round(
    results.reduce((acc, r) => acc + r.recallPct, 0) / (results.length || 1)
  );
  const totalFPs = results.reduce((acc, r) => acc + r.definitionFPs, 0);
  const totalTruncated = results.reduce((acc, r) => acc + r.truncatedQuotes, 0);
  const totalRemoved = results.reduce((acc, r) => acc + r.removedUnverified, 0);
  const avgLatency = Math.round(
    results.reduce((acc, r) => acc + r.latencyMs, 0) / (results.length || 1)
  );

  console.log("\n--- Benchmark Quality Summary ---");
  console.log(`Average Recall: ${avgRecall}% (Target: >= 80%)`);
  console.log(`Definition-Clause False Positives: ${totalFPs} (Target: 0)`);
  console.log(`Truncated Quotes: ${totalTruncated} (Target: 0)`);
  console.log(`Total Hallucinations Removed: ${totalRemoved}`);
  console.log(`Average Latency: ${avgLatency} ms`);
  console.log("---------------------------------\n");
}

runEvaluation().catch((err) => {
  console.error("Evaluation script failed:", err);
  process.exit(1);
});
