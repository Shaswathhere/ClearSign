/**
 * scripts/eval.ts
 * Evaluates the ClearSign pipeline against the planted traps in samples/golden.json.
 * Computes and prints:
 * - Recall of planted traps (%)
 * - Extra findings count
 * - Removed unverified count (anti-hallucination metric)
 * - End-to-end latency (ms)
 * 
 * Usage: npx tsx scripts/eval.ts
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
  console.log(`  LLM Engine: ${hasKey ? `Groq (${process.env.LLM_MODEL || "llama-3.3-70b-versatile"})` : "Rules-only fallback (LLM_API_KEY unset)"}`);
  console.log("=======================================================\n");

  const results: Array<{
    name: string;
    plantedTotal: number;
    plantedFound: number;
    recallPct: number;
    extraFindings: number;
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

    // 6. Match against planted traps
    let matchedPlantedCount = 0;
    const matchedVerifiedIndices = new Set<number>();

    for (const planted of sample.plantedTraps) {
      const pSnippetNorm = normalizeText(planted.quoteSnippet);

      let found = false;
      for (let i = 0; i < verified.length; i++) {
        const v = verified[i];
        const vNorm = normalizeText(v.quote);

        // Match if category matches and quote overlaps or contains snippet
        if (
          v.category === planted.category &&
          (vNorm.includes(pSnippetNorm) || pSnippetNorm.includes(vNorm) || vNorm.slice(0, 30) === pSnippetNorm.slice(0, 30))
        ) {
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
      removedUnverified,
      score,
      band,
      latencyMs,
    });
  }

  // Print results table
  console.log("| Document | Planted Traps | Recalled | Recall % | Extra Findings | Removed Unverified | Score / Band | Latency |");
  console.log("|---|---|---|---|---|---|---|---|");
  for (const r of results) {
    console.log(
      `| **${r.name}** | ${r.plantedTotal} | ${r.plantedFound} | **${r.recallPct}%** | ${r.extraFindings} | ${r.removedUnverified} | ${r.score}/100 (${r.band}) | ${r.latencyMs} ms |`
    );
  }

  const avgRecall = Math.round(
    results.reduce((acc, r) => acc + r.recallPct, 0) / (results.length || 1)
  );
  const totalRemoved = results.reduce((acc, r) => acc + r.removedUnverified, 0);
  const avgLatency = Math.round(
    results.reduce((acc, r) => acc + r.latencyMs, 0) / (results.length || 1)
  );

  console.log("\n--- Overall Benchmark Summary ---");
  console.log(`Average Recall: ${avgRecall}% (PRD Section 2.3 target: >= 80%)`);
  console.log(`Total Hallucinations Removed: ${totalRemoved}`);
  console.log(`Average Latency: ${avgLatency} ms (PRD Section 2.3 target: <= 15,000 ms)`);
  console.log("---------------------------------\n");
}

runEvaluation().catch((err) => {
  console.error("Evaluation script failed:", err);
  process.exit(1);
});
