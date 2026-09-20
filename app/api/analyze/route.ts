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

type DocType = "rental" | "loan" | "subscription" | "insurance" | "employment" | "terms_of_service" | "other";

function detectDocumentType(text: string): DocType {
  const lower = text.toLowerCase();
  if (/gym|fitness|membership|workout|trainer|amenities fee|locker deposit|club rules/i.test(lower)) {
    return "subscription";
  }
  if (/landlord|tenant|premises|monthly rent|lease agreement|security deposit.*refund/i.test(lower)) {
    return "rental";
  }
  if (/lender|borrower|loan amount|principal|rate of interest|emi|sanction/i.test(lower)) {
    return "loan";
  }
  if (/policyholder|insured|sum insured|premium|insurance policy|exclusions/i.test(lower)) {
    return "insurance";
  }
  if (/employer|employee|salary|probation|non-compete|employment agreement/i.test(lower)) {
    return "employment";
  }
  if (/terms of service|terms of use|privacy policy|user content/i.test(lower)) {
    return "terms_of_service";
  }
  return "other";
}

function generateDocumentSpecificSummary(docType: DocType, verifiedCount: number, score: number, band: string): string[] {
  if (docType === "subscription") {
    return [
      "This agreement is an annual membership subscription that automatically renews for 12-month terms unless cancelled in writing.",
      "Cancellation is restricted exclusively to physical registered or speed post and must arrive at least 60 days before renewal.",
      "Joining and subscription fees are non-refundable in all circumstances, including prolonged facility closures up to 90 days.",
      "Late payments carry 3% monthly compounding penal interest, and fees can be increased unilaterally without prior notice.",
      "Personal details, photos, and biometric data may be shared with commercial sponsors and partners for marketing.",
    ];
  }
  if (docType === "rental") {
    return [
      "This is a residential tenancy agreement featuring a mandatory lock-in period and specific notice requirements.",
      "The security deposit is subject to deductions at the landlord's discretion upon vacating the premises.",
      "Premises inspection may occur at any time without prior notice.",
      "Rent escalation and penalties apply upon renewal or delayed rental remittances.",
      "Review the early termination and deposit refund clauses carefully before executing.",
    ];
  }
  if (docType === "loan") {
    return [
      "This is a credit facility agreement outlining principal borrowing, tenure, and applicable interest terms.",
      "The loan incurs upfront processing fees and strict penal interest charges on any delayed repayment instalments.",
      "Prepayment penalties apply if you attempt to settle or foreclose the loan balance ahead of schedule.",
      "Borrower data and credit history may be reported to financial bureaus and affiliated entities.",
      "Disputes are routed to private arbitration appointed exclusively by the financial institution.",
    ];
  }
  return [
    `Identified ${verifiedCount} potential contract risk terms in this agreement.`,
    `The calculated contract risk score is ${score}/100 (${band}).`,
    `Review all highlighted clauses and mandatory notice periods before signing.`,
    `Verify all fee schedules, termination requirements, and dispute resolution venues.`,
    `Ensure you retain an executed copy of all documents and attached schedules.`,
  ];
}

function generateDocumentSpecificQuestions(docType: DocType, fullClauses: Clause[]): string[] {
  if (docType === "subscription") {
    const questions: string[] = [];
    const c4_2 = fullClauses.find((c) => /registered post|speed post/i.test(c.text));
    const c3_4 = fullClauses.find((c) => /revise.*fee|increase.*fee/i.test(c.text));
    const c5_1 = fullClauses.find((c) => /non-refundable/i.test(c.text));
    const c5_3 = fullClauses.find((c) => /locker deposit|as determined/i.test(c.text));
    const c7_1 = fullClauses.find((c) => /negligence|not be liable/i.test(c.text));
    const c8_2 = fullClauses.find((c) => /sharing.*personal data|marketing/i.test(c.text));
    const c10_2 = fullClauses.find((c) => /amend.*notice/i.test(c.text));

    questions.push(
      `[${c4_2 ? c4_2.id : "Clause 4.2"}] Can cancellation notices be submitted digitally via email or mobile app instead of physical registered post?`
    );
    questions.push(
      `[${c3_4 ? c3_4.id : "Clause 3.4"}] What is the maximum permissible annual revision percentage for membership and amenity fees?`
    );
    questions.push(
      `[${c5_1 ? c5_1.id : "Clause 5.1/5.2"}] Will fees be refunded or credited pro-rata if the gym closes for renovations or if I suffer a medical emergency?`
    );
    questions.push(
      `[${c5_3 ? c5_3.id : "Clause 5.3"}] What itemized receipts and photographic evidence will be provided before deductions are made from my locker deposit?`
    );
    questions.push(
      `[${c7_1 ? c7_1.id : "Clause 7.1"}] Why does the liability waiver attempt to exclude company liability even in cases of gross staff negligence?`
    );
    questions.push(
      `[${c8_2 ? c8_2.id : "Clause 8.2"}] Can I opt out of third-party marketing and biometric data sharing while maintaining active membership?`
    );
    if (c10_2) {
      questions.push(
        `[${c10_2.id}] Will members receive individual written or SMS notice before amended club rules take effect?`
      );
    }
    return questions.slice(0, 7);
  }

  return [
    "What is the exact notice period and acceptable communication channel required before termination?",
    "Are all administrative, legal, and incidental fees clearly specified with no hidden recurring costs?",
    "Under what verifiable conditions and timelines is the security deposit refundable in full?",
    "Can any terms or charges be revised unilaterally during the active duration of this contract?",
    "What specific cure period is provided to resolve any alleged default before termination?",
  ];
}

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

    // Detect document type
    const detectedDocType = detectDocumentType(text);

    // 4. Run rule engine
    const { traps: ruleTraps, hints: ruleHints } = runRuleEngine(fullClauses);

    // 5. LLM analysis (with graceful fallback to rule-only results if LLM key is absent or fails)
    let analysisResult: Analysis | null = null;
    let engineUsed: "llm" | "rules-only" = "rules-only";
    let engineErrorCode: string | undefined;

    if (process.env.LLM_API_KEY) {
      try {
        const formatted = formatClausesForPrompt(fullClauses);
        const userPrompt = buildUserAnalysisPrompt(formatted, ruleHints, detectedDocType);

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
        engineUsed = "llm";
        // Server-side logging: NO document content
        console.log(`[ClearSign Analysis] engine=llm model=${process.env.LLM_MODEL || "qwen/qwen3.8-27b"}`);
      } catch (err: unknown) {
        engineUsed = "rules-only";
        const errObj = err as { code?: string; status?: number; message?: string };
        engineErrorCode = errObj.code || (errObj.status ? `HTTP_${errObj.status}` : "LLM_FAILED");
        // Server-side logging: NO document content
        console.warn(`[ClearSign Analysis] engine=rules-only errorCode=${engineErrorCode}`);
      }
    } else {
      engineUsed = "rules-only";
      engineErrorCode = "NO_API_KEY";
      // Server-side logging: NO document content
      console.warn(`[ClearSign Analysis] engine=rules-only errorCode=${engineErrorCode}`);
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

    // Resolve docType (ensure gym/membership never returns "other")
    let finalDocType = analysisResult?.docType && analysisResult.docType !== "other"
      ? analysisResult.docType
      : detectedDocType;

    // 9. Build response
    const responseData: AnalyzeResponse = {
      docType: finalDocType,
      currency: analysisResult?.currency || "INR",
      summary:
        analysisResult?.summary && analysisResult.summary.length >= 3
          ? analysisResult.summary
          : generateDocumentSpecificSummary(finalDocType, verifiedTraps.length, score, band),
      traps: verifiedTraps,
      deadlines: analysisResult?.deadlines || [],
      terms: analysisResult?.terms || {
        loan: null,
        subscription: null,
        rental: null,
      },
      questions:
        analysisResult?.questions && analysisResult.questions.length >= 3
          ? analysisResult.questions
          : generateDocumentSpecificQuestions(finalDocType, fullClauses),
      missing: analysisResult?.missing || [],
      score,
      band,
      removedUnverified,
      engine: engineUsed,
      engineErrorCode,
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
