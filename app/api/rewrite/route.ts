import { NextResponse } from "next/server";

const REWRITE_SYSTEM = `You are a helpful language tutor.
Given a learner's sentence or short paragraph, rewrite it into a version that feels natural and fluent for a native speaker.

Language: The text may be in any language (English, French, Spanish, etc.). Rewrite in the SAME language as the input. Make it natural for a native speaker of that language.

Rules:
- Keep the same meaning and tone.
- You MAY adjust word choice and sentence structure for naturalness.
- Prefer everyday, clear phrasing over complex or formal alternatives.
- Return ONLY the rewritten text, nothing else (no preamble, no quotes).`;

export async function POST(req: Request) {
  try {
    const { text } = (await req.json()) as { text?: string };
    if (!text || typeof text !== "string" || !text.trim()) {
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
          { role: "system", content: REWRITE_SYSTEM },
          { role: "user", content: text },
        ],
        temperature: 0.5,
        max_tokens: 300,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `OpenAI API error: ${res.status}`, details: body },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string | null } }>;
    };
    const raw = data.choices?.[0]?.message?.content ?? "";
    const rewrite =
      typeof raw === "string" && raw.trim() ? raw.trim() : text;

    return NextResponse.json({ rewrite });
  } catch (e) {
    console.error("Rewrite API error:", e);
    return NextResponse.json(
      { error: "Rewrite failed" },
      { status: 500 }
    );
  }
}

