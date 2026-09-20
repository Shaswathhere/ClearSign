/**
 * /api/translate – Translate explanation fields only (Phase 5)
 * Quotes are NEVER sent; only user-facing explanation text is translated.
 * PRD F1–F3.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callLlm } from "@/lib/llm";
import { checkRateLimit } from "@/lib/ratelimit";

export const maxDuration = 30;

const SUPPORTED_LANGS = ["hi", "ta", "te", "kn", "ml", "bn", "mr"] as const;

const TranslateRequest = z.object({
  target: z.enum(SUPPORTED_LANGS),
  payload: z.object({
    summary: z.array(z.string()).max(20),
    traps: z.array(z.object({
      why: z.string(),
      action: z.string(),
      question: z.string().nullable().optional(),
    })).max(50),
    questions: z.array(z.string()).max(20),
    deadlines: z.array(z.object({ label: z.string() })).max(30),
    missing: z.array(z.object({ item: z.string(), why: z.string() })).max(20),
  }),
});

const LANG_NAMES: Record<string, string> = {
  hi: "Hindi",
  ta: "Tamil",
  te: "Telugu",
  kn: "Kannada",
  ml: "Malayalam",
  bn: "Bengali",
  mr: "Marathi",
};

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const { allowed } = checkRateLimit(`translate:${ip}`, 20);
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Too many translation requests. Please wait a moment." } },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "BAD_INPUT", message: "Invalid JSON." } }, { status: 400 });
  }

  const parsed = TranslateRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_INPUT", message: parsed.error.issues[0]?.message || "Invalid request." } },
      { status: 400 }
    );
  }

  const { target, payload } = parsed.data;
  const langName = LANG_NAMES[target];

  // Build a compact JSON for the LLM to translate
  const toTranslate = {
    summary: payload.summary,
    traps: payload.traps,
    questions: payload.questions,
    deadlines: payload.deadlines,
    missing: payload.missing,
  };

  const systemPrompt = `You are a precise translator. Translate the provided JSON into ${langName}.
Rules:
1. Translate ONLY the string values. Do NOT translate JSON keys.
2. Keep all clause references like [C3] exactly as-is.
3. Keep numbers, currency symbols, percentages, and dates exactly as-is.
4. Return valid JSON with the exact same structure as the input. No extra commentary.
5. Use plain, Grade-6 vocabulary appropriate for ordinary people.`;

  const userMessage = `Translate this JSON to ${langName}:\n${JSON.stringify(toTranslate)}`;

  try {
    const raw = await callLlm(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      { maxTokens: 3000, temperature: 0.1 }
    );

    // Extract JSON from response (model may wrap in markdown fences)
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]+?)```/) || [null, raw];
    const jsonStr = (jsonMatch[1] || raw).trim();

    let translated: typeof toTranslate;
    try {
      translated = JSON.parse(jsonStr);
    } catch {
      // Fallback: return the original if parse fails
      return NextResponse.json(payload);
    }

    // Validate shapes match before returning
    const result = {
      summary: Array.isArray(translated.summary) ? translated.summary : payload.summary,
      traps: Array.isArray(translated.traps) ? translated.traps : payload.traps,
      questions: Array.isArray(translated.questions) ? translated.questions : payload.questions,
      deadlines: Array.isArray(translated.deadlines) ? translated.deadlines : payload.deadlines,
      missing: Array.isArray(translated.missing) ? translated.missing : payload.missing,
    };

    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Translation failed.";
    return NextResponse.json(
      { error: { code: "LLM_UNAVAILABLE", message: msg } },
      { status: 502 }
    );
  }
}
