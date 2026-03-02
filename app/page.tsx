"use client";

import { useState } from "react";
import { Recorder } from "@/components/Recorder";
import { HighlightedSentence } from "@/components/HighlightedSentence";
import { HistoryList } from "@/components/HistoryList";
import { saveAttempt } from "@/lib/history";
import { saveAudio } from "@/lib/audioStore";
import type { AnalysisResult } from "@/lib/types";

const DEFAULT_SENTENCE = "The quick brown fox jumps over the lazy dog.";

export default function Home() {
  const [targetText, setTargetText] = useState(DEFAULT_SENTENCE);
  const [draft, setDraft] = useState(DEFAULT_SENTENCE);
  const [isEditing, setIsEditing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  async function handleResult(analysis: AnalysisResult, audioBlob: Blob) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    saveAttempt({
      id,
      createdAt: new Date().toISOString(),
      targetText: analysis.targetText,
      transcript: analysis.transcript,
      feedback: analysis.issues,
      topTag: analysis.tags[0] ?? "",
    });
    await saveAudio(id, audioBlob);
    setResult(analysis);
    setHistoryKey((k) => k + 1);
  }

  function startEditing() {
    setDraft(targetText);
    setIsEditing(true);
  }

  function confirmEdit() {
    const trimmed = draft.trim();
    if (trimmed) {
      setTargetText(trimmed);
      setResult(null);
    }
    setIsEditing(false);
  }

  function cancelEdit() {
    setIsEditing(false);
  }

  return (
    <main className="mx-auto flex max-w-md flex-col gap-8 px-4 py-8">
      <h1 className="text-2xl font-bold text-zinc-800">Pronunciation Practice</h1>

      {/* Practice card */}
      <section className="flex flex-col gap-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
        {isEditing ? (
          <div className="flex flex-col gap-3">
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-xl border border-zinc-300 p-3 text-base text-zinc-800 focus:border-indigo-400 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                onClick={confirmEdit}
                disabled={!draft.trim()}
                className="flex-1 rounded-xl bg-indigo-600 py-2 text-sm font-medium text-white disabled:opacity-40 active:bg-indigo-700"
              >
                Done
              </button>
              <button
                onClick={cancelEdit}
                className="flex-1 rounded-xl border border-zinc-200 py-2 text-sm font-medium text-zinc-600 active:bg-zinc-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <p className="text-base font-medium leading-relaxed text-zinc-700">{targetText}</p>
            <button
              onClick={startEditing}
              aria-label="Edit sentence"
              className="shrink-0 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 active:bg-zinc-200"
            >
              <PencilIcon />
            </button>
          </div>
        )}

        {!isEditing && <Recorder targetText={targetText} onResult={handleResult} />}
      </section>

      {/* Feedback card */}
      {result && (
        <section className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Feedback
            </h2>
            <span className="text-sm font-semibold text-indigo-600">
              {result.fluencyScore}/100
            </span>
          </div>

          <HighlightedSentence targetText={result.targetText} issues={result.issues} />

          <p className="text-sm text-zinc-500">
            <span className="text-zinc-400">You said: </span>
            {result.transcript}
          </p>

          {result.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs text-zinc-500"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </section>
      )}

      {/* History */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">History</h2>
        <HistoryList key={historyKey} />
      </section>
    </main>
  );
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
    </svg>
  );
}
