import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { transcribeImages } from "@/lib/llm";

const TranscribeRequestSchema = z.object({
  images: z
    .array(z.string())
    .min(1, "Please provide at least 1 image.")
    .max(5, "Maximum 5 images allowed per analysis."),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = TranscribeRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: {
            code: "BAD_INPUT",
            message: parsed.error.issues[0]?.message || "Invalid request body.",
          },
        },
        { status: 400 }
      );
    }

    if (!process.env.LLM_API_KEY) {
      return NextResponse.json(
        {
          error: {
            code: "LLM_UNAVAILABLE",
            message: "LLM service is not configured. Please set LLM_API_KEY.",
          },
        },
        { status: 503 }
      );
    }

    const transcribedText = await transcribeImages(parsed.data.images);
    if (!transcribedText || transcribedText.length < 50) {
      return NextResponse.json(
        {
          error: {
            code: "UNREADABLE_IMAGE",
            message: "Could not clearly read text from the provided images. Try better lighting or flatten the page.",
          },
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: transcribedText });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to transcribe images.";
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
