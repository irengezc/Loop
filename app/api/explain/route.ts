import { NextResponse } from "next/server";

const EXPLAIN_SYSTEM = `You explain proofreading changes in one short sentence. Given the original phrase and the corrected phrase, say why the change was made (e.g. grammar, word choice, clarity). Be concise. No preamble.`;

export async function POST(req: Request) {
  try {
    const { original, corrected } = (await req.json()) as {
      original?: string;
      corrected?: string;
    };
    if (
      typeof original !== "string" ||
      typeof corrected !== "string" ||
      !original.trim() ||
      !corrected.trim()
    ) {
      return NextResponse.json(
        { error: "Missing or invalid original/corrected" },
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
          { role: "system", content: EXPLAIN_SYSTEM },
          {
            role: "user",
            content: `Original: "${original}"\nCorrected: "${corrected}"`,
          },
        ],
        max_tokens: 150,
        temperature: 0.3,
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
    const raw = data.choices?.[0]?.message?.content;
    const explanation =
      typeof raw === "string" && raw.trim() ? raw.trim() : "Word choice or grammar improved.";

    return NextResponse.json({ explanation });
  } catch (e) {
    console.error("Explain API error:", e);
    return NextResponse.json(
      { error: "Explanation failed" },
      { status: 500 }
    );
  }
}
