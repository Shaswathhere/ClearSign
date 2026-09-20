/**
 * lib/llm.ts
 * Provider-agnostic LLM wrapper supporting Groq (groq-sdk) with JSON mode,
 * automatic retry on validation failure, and vision transcription.
 */

import Groq from "groq-sdk";

function getGroqClient(): Groq {
  const apiKey = process.env.LLM_API_KEY;
  if (!apiKey) {
    throw new Error("LLM_API_KEY environment variable is not configured.");
  }
  return new Groq({ apiKey });
}

export const DEFAULT_MODEL = process.env.LLM_MODEL || "openai/gpt-oss-20b";
export const VISION_MODEL = process.env.LLM_MODEL_VISION || "llama-3.2-11b-vision-preview";

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
 */
export async function callLLMJson<T>(
  systemPrompt: string,
  userPrompt: string,
  validate: (raw: unknown) => { success: true; data: T } | { success: false; error: unknown },
  model: string = DEFAULT_MODEL
): Promise<T> {
  const client = getGroqClient();

  const makeAttempt = async (promptModifier?: string): Promise<T> => {
    const messages: Array<{ role: "system" | "user"; content: string }> = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: promptModifier ? `${userPrompt}\n\n[Previous attempt validation error: ${promptModifier}. Please fix the JSON output to strictly match the schema.]` : userPrompt,
      },
    ];

    const completion = await client.chat.completions.create({
      model,
      messages,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096,
    });

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
    // Retry once with the error message as instructed in PRD B3 / Section 13.3
    const firstMsg = firstErr instanceof Error ? firstErr.message : "Validation error";
    try {
      return await makeAttempt(firstMsg);
    } catch (secondErr: unknown) {
      const secondMsg = secondErr instanceof Error ? secondErr.message : "Validation retry failed";
      throw new Error(`LLM failed schema validation after retry: ${secondMsg}`);
    }
  }
}
