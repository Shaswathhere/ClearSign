/**
 * lib/llm.ts
 * Provider-agnostic LLM wrapper supporting Groq (groq-sdk) with strict JSON schema mode,
 * automatic fallback to JSON object mode, retry on validation failure, and vision transcription.
 */

import Groq from "groq-sdk";

function getGroqClient(): Groq {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY environment variable is not configured.");
  }
  return new Groq({ apiKey });
}

export const DEFAULT_MODEL = process.env.LLM_MODEL || "qwen/qwen3.8-27b";
export const VISION_MODEL = process.env.LLM_MODEL_VISION || "llama-3.2-11b-vision-preview";

export const ANALYSIS_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    docType: {
      type: "string",
      enum: ["rental", "loan", "subscription", "insurance", "employment", "terms_of_service", "other"],
    },
    currency: { type: "string" },
    summary: {
      type: "array",
      items: { type: "string" },
    },
    traps: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          clauseId: { type: "string" },
          quote: { type: "string" },
          category: {
            type: "string",
            enum: [
              "auto_renewal",
              "lock_in_termination",
              "penalty_fee",
              "unilateral_change",
              "refund_deposit",
              "interest_rate",
              "liability_indemnity",
              "arbitration_jurisdiction",
              "data_privacy",
              "exclusion_coverage",
              "non_compete_ip",
              "hidden_charges",
              "vague_terms",
              "other",
            ],
          },
          severity: { type: "string", enum: ["high", "medium", "low"] },
          why: { type: "string" },
          action: { type: "string" },
          question: { anyOf: [{ type: "string" }, { type: "null" }] },
        },
        required: ["clauseId", "quote", "category", "severity", "why", "action", "question"],
      },
    },
    deadlines: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          clauseId: { type: "string" },
          quote: { type: "string" },
          label: { type: "string" },
          absoluteDate: { anyOf: [{ type: "string" }, { type: "null" }] },
          relative: {
            anyOf: [
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  n: { type: "number" },
                  unit: { type: "string", enum: ["day", "week", "month", "year"] },
                  direction: { type: "string", enum: ["before", "after"] },
                  anchor: {
                    type: "string",
                    enum: ["start_date", "renewal_date", "end_date", "signing_date", "other"],
                  },
                },
                required: ["n", "unit", "direction", "anchor"],
              },
              { type: "null" },
            ],
          },
        },
        required: ["clauseId", "quote", "label", "absoluteDate", "relative"],
      },
    },
    terms: {
      type: "object",
      additionalProperties: false,
      properties: {
        loan: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                principal: { type: "number" },
                annualRatePct: { type: "number" },
                tenureMonths: { type: "number" },
                processingFeePct: { anyOf: [{ type: "number" }, { type: "null" }] },
                prepaymentPenaltyPct: { anyOf: [{ type: "number" }, { type: "null" }] },
              },
              required: [
                "principal",
                "annualRatePct",
                "tenureMonths",
                "processingFeePct",
                "prepaymentPenaltyPct",
              ],
            },
            { type: "null" },
          ],
        },
        subscription: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                price: { type: "number" },
                billingPeriodMonths: { type: "number" },
                autoRenews: { type: "boolean" },
                cancelNoticeDays: { anyOf: [{ type: "number" }, { type: "null" }] },
                earlyExitFee: { anyOf: [{ type: "number" }, { type: "null" }] },
              },
              required: [
                "price",
                "billingPeriodMonths",
                "autoRenews",
                "cancelNoticeDays",
                "earlyExitFee",
              ],
            },
            { type: "null" },
          ],
        },
        rental: {
          anyOf: [
            {
              type: "object",
              additionalProperties: false,
              properties: {
                monthlyRent: { type: "number" },
                deposit: { anyOf: [{ type: "number" }, { type: "null" }] },
                lockInMonths: { anyOf: [{ type: "number" }, { type: "null" }] },
                noticeMonths: { anyOf: [{ type: "number" }, { type: "null" }] },
                annualEscalationPct: { anyOf: [{ type: "number" }, { type: "null" }] },
              },
              required: [
                "monthlyRent",
                "deposit",
                "lockInMonths",
                "noticeMonths",
                "annualEscalationPct",
              ],
            },
            { type: "null" },
          ],
        },
      },
      required: ["loan", "subscription", "rental"],
    },
    questions: {
      type: "array",
      items: { type: "string" },
    },
    missing: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          item: { type: "string" },
          why: { type: "string" },
        },
        required: ["item", "why"],
      },
    },
  },
  required: ["docType", "currency", "summary", "traps", "deadlines", "terms", "questions", "missing"],
};

/**
 * Transcribes 1 to 5 images verbatim using Groq's vision model.
 */
export async function transcribeImages(base64Images: string[]): Promise<string> {
  const client = getGroqClient();

  const contentParts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
  > = [
    {
      type: "text",
      text: "Transcribe the document in these images verbatim. Do not summarize, interpret, or omit any text. Preserve all headings, section numbers, punctuation, and clause formatting exactly as printed.",
    },
  ];

  for (const b64 of base64Images) {
    const dataUrl = b64.startsWith("data:") ? b64 : `data:image/jpeg;base64,${b64}`;
    contentParts.push({
      type: "image_url",
      image_url: { url: dataUrl },
    });
  }

  const response = await client.chat.completions.create({
    model: VISION_MODEL,
    messages: [
      {
        role: "user",
        content: contentParts,
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  });

  return response.choices[0]?.message?.content?.trim() || "";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Free-form (text) LLM call – used by /api/ask.
 */
export async function callLlm(
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number; model?: string } = {}
): Promise<string> {
  const client = getGroqClient();
  const { maxTokens = 1024, temperature = 0.2, model = DEFAULT_MODEL } = opts;

  const completion = await client.chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return completion.choices[0]?.message?.content?.trim() || "";
}

/**
 * Calls the LLM in JSON mode with automatic single retry on schema/parsing failure.
 * Supports strict json_schema mode with graceful fallback to json_object mode.
 */
export async function callLLMJson<T>(
  systemPrompt: string,
  userPrompt: string,
  validate: (raw: unknown) => { success: true; data: T } | { success: false; error: unknown },
  model: string = DEFAULT_MODEL
): Promise<T> {
  const client = getGroqClient();

  const makeAttempt = async (promptModifier?: string, forceJsonObject = false): Promise<T> => {
    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: promptModifier
          ? `${userPrompt}\n\n[Previous attempt validation error: ${promptModifier}. Please fix the JSON output to strictly match the schema.]`
          : userPrompt,
      },
    ];

    let completion;
    if (!forceJsonObject) {
      try {
        completion = await client.chat.completions.create({
          model,
          messages,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "contract_analysis",
              strict: true,
              schema: ANALYSIS_JSON_SCHEMA,
            },
          },
          temperature: 0.1,
          max_tokens: 8192,
        });
      } catch (err: unknown) {
        // If json_schema is unsupported or fails with schema validation, fallback to json_object
        completion = await client.chat.completions.create({
          model,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.1,
          max_tokens: 8192,
        });
      }
    } else {
      completion = await client.chat.completions.create({
        model,
        messages,
        response_format: { type: "json_object" },
        temperature: 0.1,
        max_tokens: 8192,
      });
    }

    const rawContent = completion.choices[0]?.message?.content?.trim() || "{}";
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawContent);
    } catch (parseErr: unknown) {
      const msg = parseErr instanceof Error ? parseErr.message : "Unknown JSON parse error";
      throw new Error(`Invalid JSON returned by LLM: ${msg}`);
    }

    const validationResult = validate(parsed);
    if (!validationResult.success) {
      throw new Error(JSON.stringify(validationResult.error));
    }

    return validationResult.data;
  };

  try {
    return await makeAttempt();
  } catch (firstErr: unknown) {
    const firstMsg = firstErr instanceof Error ? firstErr.message : "Validation error";
    try {
      return await makeAttempt(firstMsg, true);
    } catch (secondErr: unknown) {
      const secondMsg = secondErr instanceof Error ? secondErr.message : "Validation retry failed";
      throw new Error(`LLM failed schema validation after retry: ${secondMsg}`);
    }
  }
}
