import { NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a precise grammar tutor.
Given a learner's text, you identify IMPORTANT grammar/usage mistakes and output a JSON object.

Rules:
- Focus on recurring, meaningful grammar/usage issues (articles, tense, word form, prepositions, agreement, etc.).
- Ignore purely stylistic changes unless they fix a clear error.
- Keep explanations short and learner-friendly.
- Do NOT correct everything; prioritise the most helpful issues.

Output format (MUST be valid JSON and nothing else):
{
  "issues": [
    {
      "sentence": "original sentence containing the mistake",
      "correctedSentence": "corrected version of that sentence",
      "mistakeType": "short category name, e.g. Articles, Tense, Word form, Prepositions, Agreement, Other",
      "explanation": "1 short sentence explaining the issue in simple language"
    }
  ]
}

Use the learner's exact sentence text in "sentence". If there are no important issues, return { "issues": [] }.
`;

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
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.2,
        max_tokens: 1200,
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
    let parsed: unknown = null;
    try {
      parsed = raw && typeof raw === "string" ? JSON.parse(raw) : null;
    } catch {
      // If the model didn't return pure JSON, fall back gracefully.
      return NextResponse.json(
        {
          error: "Could not parse grammar analysis response.",
          raw,
        },
        { status: 502 }
      );
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as any).issues)
    ) {
      return NextResponse.json(
        { error: "Grammar analysis response missing issues.", raw: parsed },
        { status: 502 }
      );
    }

    // Light validation / normalisation
    const safeIssues = (parsed as any).issues
      .filter(
        (item: any) =>
          item &&
          typeof item.sentence === "string" &&
          typeof item.correctedSentence === "string" &&
          typeof item.mistakeType === "string" &&
          typeof item.explanation === "string"
      )
      .map((item: any) => ({
        sentence: item.sentence.trim(),
        correctedSentence: item.correctedSentence.trim(),
        mistakeType: item.mistakeType.trim(),
        explanation: item.explanation.trim(),
      }));

    return NextResponse.json({ issues: safeIssues });
  } catch (e) {
    console.error("Grammar API error:", e);
    return NextResponse.json(
      { error: "Grammar analysis failed" },
      { status: 500 }
    );
  }
}

