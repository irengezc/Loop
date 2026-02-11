import { NextResponse } from "next/server";

const PROOFREAD_SYSTEM = `You are a proofreader. Return ONLY the corrected text, nothing else.
- The text may be in any language (English, French, Spanish, etc.). Correct it in the SAME language.
- Fix grammar, spelling, punctuation, and word choice. Preserve paragraphs and line breaks.
- Keep the same meaning and tone. Do not add explanations, quotes, or preamble.
- If the text is already correct, return it unchanged.`;

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text: string };
    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid text" },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not set" },
        { status: 503 }
      );
    }

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: PROOFREAD_SYSTEM },
          { role: "user", content: text },
        ],
        max_tokens: 2000,
        temperature: 0.2,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json(
        { error: `OpenAI API error: ${res.status}`, details: err },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const raw =
      data.choices?.[0]?.message?.content;
    const suggestion =
      typeof raw === "string" && raw.trim()
        ? raw.trim()
        : text;

    return NextResponse.json({ suggestion });
  } catch (e) {
    console.error("Proofread API error:", e);
    return NextResponse.json(
      { error: "Proofread failed" },
      { status: 500 }
    );
  }
}
