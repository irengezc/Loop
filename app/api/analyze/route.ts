import { NextRequest, NextResponse } from "next/server";
import type { AnalysisResult } from "@/lib/types";

const COMPARE_SYSTEM = `You are a pronunciation coach. Given a target sentence and the transcript of what a learner said, identify pronunciation issues.

Return ONLY valid JSON — no markdown, no explanation — in exactly this shape:
{
  "targetText": "<the target sentence>",
  "transcript": "<what the learner said>",
  "issues": [
    {
      "word": "<word from targetText>",
      "startIndex": <integer: char index in targetText where word starts>,
      "endIndex": <integer: char index in targetText where word ends, exclusive>,
      "type": "<substitution|deletion|insertion|mispronunciation|stress>",
      "hint": "<one short actionable tip>",
      "severity": "<low|medium|high>"
    }
  ],
  "tags": ["<pattern tag>"],
  "fluencyScore": <integer 0–100>
}

Rules:
- issues must contain at most 5 entries, ordered by severity descending.
- tags describe overall patterns (e.g. "linking", "vowel reduction", "word stress", "omission").
- fluencyScore reflects overall intelligibility and accuracy (100 = perfect).
- If the transcript closely matches the target, return an empty issues array and a high fluencyScore.
- startIndex/endIndex are character offsets into targetText, not the transcript.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 503 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart/form-data" }, { status: 400 });
  }

  const targetText = formData.get("targetText");
  const audioFile = formData.get("audio");

  if (typeof targetText !== "string" || !targetText.trim()) {
    return NextResponse.json({ error: "Missing targetText" }, { status: 400 });
  }
  if (!(audioFile instanceof File) || audioFile.size === 0) {
    return NextResponse.json({ error: "Missing or empty audio file" }, { status: 400 });
  }

  // Step 1: Transcribe with Whisper
  const whisperForm = new FormData();
  whisperForm.append("file", audioFile, audioFile.name || "recording.webm");
  whisperForm.append("model", "whisper-1");
  whisperForm.append("response_format", "text");

  const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: whisperForm,
  });

  if (!whisperRes.ok) {
    const err = await whisperRes.text();
    return NextResponse.json({ error: "Transcription failed", details: err }, { status: 502 });
  }

  const transcript = (await whisperRes.text()).trim();

  // Step 2: Compare with GPT
  const gptRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: COMPARE_SYSTEM },
        {
          role: "user",
          content: `Target: "${targetText.trim()}"\nTranscript: "${transcript}"`,
        },
      ],
      max_tokens: 800,
      temperature: 0.2,
    }),
  });

  if (!gptRes.ok) {
    const err = await gptRes.text();
    return NextResponse.json({ error: "Analysis failed", details: err }, { status: 502 });
  }

  const gptData = (await gptRes.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };

  const raw = gptData.choices?.[0]?.message?.content;
  if (!raw) {
    return NextResponse.json({ error: "Empty response from model" }, { status: 502 });
  }

  let result: AnalysisResult;
  try {
    result = JSON.parse(raw) as AnalysisResult;
    // Enforce max 5 issues
    result.issues = (result.issues ?? []).slice(0, 5);
  } catch {
    return NextResponse.json({ error: "Model returned invalid JSON" }, { status: 502 });
  }

  return NextResponse.json(result);
}
