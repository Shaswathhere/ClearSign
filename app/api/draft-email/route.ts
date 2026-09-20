/**
 * /api/draft-email – Draft a negotiation email (Phase 7 / P1)
 * Covers the top 3 traps in a polite or firm tone.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callLlm } from "@/lib/llm";
import { checkRateLimit } from "@/lib/ratelimit";
import { Severity, Category } from "@/lib/schema";

export const maxDuration = 30;

const DraftEmailRequest = z.object({
  tone: z.enum(["polite", "firm"]).default("polite"),
  traps: z.array(z.object({
    clauseId: z.string(),
    quote: z.string().max(400),
    category: Category,
    severity: Severity,
    why: z.string().max(280),
    action: z.string().max(200),
  })).min(1).max(15),
  docType: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
  const { allowed } = checkRateLimit(`draft:${ip}`, 5);
  if (!allowed) {
    return NextResponse.json(
      { error: { code: "RATE_LIMIT", message: "Too many requests. Please wait a moment." } },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { code: "BAD_INPUT", message: "Invalid JSON." } }, { status: 400 });
  }

  const parsed = DraftEmailRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "BAD_INPUT", message: parsed.error.issues[0]?.message || "Invalid request." } },
      { status: 400 }
    );
  }

  const { tone, traps, docType } = parsed.data;
  // Only use top 3 traps by severity
  const top3 = traps.slice(0, 3);

  const systemPrompt = `You are helping someone negotiate a ${docType || "contract"}.
Write a ${tone} email requesting changes to concerning contract terms.
Do NOT provide legal advice. Focus on asking clarifying questions or requesting amendments.
Return ONLY valid JSON with keys: "subject" (string) and "body" (string with \\n for newlines).
Keep the body under 300 words. Use plain language. Address the recipient as "Dear [Name/Party]".`;

  const trapSummary = top3.map((t, i) =>
    `${i + 1}. [${t.clauseId}] ${t.category.replace(/_/g, " ")} — "${t.quote.slice(0, 150)}" — Concern: ${t.why} — Requested action: ${t.action}`
  ).join("\n\n");

  const userMessage = `Contract concerns to address:\n${trapSummary}\n\nTone: ${tone}`;

  try {
    const raw = await callLlm(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      { maxTokens: 800, temperature: 0.2 }
    );

    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]+?)```/) || [null, raw];
    const jsonStr = (jsonMatch[1] || raw).trim();

    let result: { subject: string; body: string };
    try {
      result = JSON.parse(jsonStr);
      if (!result.subject || !result.body) throw new Error("Missing fields");
    } catch {
      return NextResponse.json(
        { error: { code: "LLM_UNAVAILABLE", message: "Could not generate email. Please try again." } },
        { status: 502 }
      );
    }

    return NextResponse.json({ subject: result.subject, body: result.body });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Email generation failed.";
    return NextResponse.json({ error: { code: "LLM_UNAVAILABLE", message: msg } }, { status: 502 });
  }
}
