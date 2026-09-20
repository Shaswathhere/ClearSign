import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Analysis, AnalyzeResponse } from "@/lib/schema";
import { Clause, segmentDocument, formatClausesForPrompt } from "@/lib/segment";
import { runRuleEngine } from "@/lib/rules";
import { SYSTEM_ANALYSIS_PROMPT, buildUserAnalysisPrompt } from "@/lib/prompts";
import { callLLMJson } from "@/lib/llm";
import { verifyAllFindings } from "@/lib/verify";
import { calculateRiskScore } from "@/lib/score";
import { checkRateLimit } from "@/lib/ratelimit";

export const maxDuration = 30; // Vercel function timeout config

const AnalyzeRequestSchema = z.object({
  text: z.string().min(200, "Text must be at least 200 characters."),
  clauses: z
    .array(
      z.object({
        id: z.string(),
        start: z.number(),
        end: z.number(),
      })
    )
    .optional(),
  locale: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    // 1. Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
    const rateCheck = checkRateLimit(ip);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: {
            code: "RATE_LIMIT",
            message: "Too many requests. Please wait a minute before analyzing another document.",
          },
        },
        { status: 429 }
      );
    }

    // 2. Request body parsing and size check
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: {
            code: "BAD_INPUT",
            message: "Invalid JSON in request body.",
          },
        },
        { status: 400 }
      );
    }

    const parsed = AnalyzeRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_INPUT",
            message: parsed.error.issues[0]?.message || "Invalid input parameters.",
          },
        },
        { status: 400 }
      );
    }

    const { text, clauses: clientClauses } = parsed.data;

    if (text.length > 60000) {
      return NextResponse.json(
        {
          error: {
            code: "TOO_LONG",
            message: "Document length exceeds 60,000 characters (~30 pages). Please provide a shorter section.",
          },
        },
        { status: 413 }
      );
    }

    // 3. Clause segmentation
    let fullClauses: Clause[];
    if (clientClauses && clientClauses.length > 0) {
      fullClauses = clientClauses.map((c) => ({
        id: c.id,
        start: c.start,
        end: c.end,
        text: text.slice(c.start, c.end),
      }));
    } else {
      fullClauses = segmentDocument(text);
    }

    // 4. Run rule engine
    const { traps: ruleTraps, hints: ruleHints } = runRuleEngine(fullClauses);

    // 5. LLM analysis (with graceful fallback to rule-only results if LLM key is absent or fails)
    let analysisResult: Analysis | null = null;

    if (process.env.LLM_API_KEY) {
      try {
        const formatted = formatClausesForPrompt(fullClauses);
        const userPrompt = buildUserAnalysisPrompt(formatted, ruleHints);

        analysisResult = await callLLMJson<Analysis>(
          SYSTEM_ANALYSIS_PROMPT,
          userPrompt,
          (raw) => {
            const res = Analysis.safeParse(raw);
            if (!res.success) {
              return { success: false, error: res.error.format() };
            }
            return { success: true, data: res.data };
          }
        );
      } catch (err) {
        console.warn("LLM analysis failed, falling back to rule engine:", err);
      }
    }

    // 6. Assemble candidate findings
    const llmTraps = analysisResult?.traps || [];

    // 7. Verify all findings against source clauses & fullText
    const { verified: verifiedTraps, removedUnverified } = verifyAllFindings(
      llmTraps,
      ruleTraps,
      fullClauses,
      text
    );

    // 8. Deterministic scoring
    const { score, band } = calculateRiskScore(verifiedTraps);

    // 9. Build response
    const responseData: AnalyzeResponse = {
      docType: analysisResult?.docType || "other",
      currency: analysisResult?.currency || "INR",
      summary:
        analysisResult?.summary && analysisResult.summary.length > 0
          ? analysisResult.summary
          : [
              `Identified ${verifiedTraps.length} potential contract risk terms.`,
              `Overall risk score is ${score}/100 (${band}).`,
              `Review all quoted terms carefully before signing.`,
            ],
      traps: verifiedTraps,
      deadlines: analysisResult?.deadlines || [],
      terms: analysisResult?.terms || {
        loan: null,
        subscription: null,
        rental: null,
      },
      questions:
        analysisResult?.questions && analysisResult.questions.length > 0
          ? analysisResult.questions
          : [
              "What is the exact notice period required before cancelling or moving out?",
              "Are all fees and potential penalties clearly listed in writing?",
              "Under what specific circumstances is my deposit refundable?",
            ],
      missing: analysisResult?.missing || [],
      score,
      band,
      removedUnverified,
    };

    return NextResponse.json(responseData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal analysis error.";
    return NextResponse.json(
      {
        error: {
          code: "LLM_UNAVAILABLE",
          message,
        },
      },
      { status: 500 }
    );
  }
}
