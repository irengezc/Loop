"use client";

import { useState } from "react";
import { Recorder } from "@/components/Recorder";
import { HistoryList } from "@/components/HistoryList";
import { saveAttempt } from "@/lib/history";
import { saveAudio } from "@/lib/audioStore";
import type { AnalysisResult } from "@/lib/types";

const SENTENCES = [
  "The quick brown fox jumps over the lazy dog.",
  "She sells seashells by the seashore.",
  "How much wood would a woodchuck chuck if a woodchuck could chuck wood?",
  "Peter Piper picked a peck of pickled peppers.",
  "I saw Susie sitting in a shoeshine shop.",
  "The thirty-three thieves thought that they thrilled the throne throughout Thursday.",
  "Whether the weather is warm, whether the weather is hot, we have to put up with the weather whether we like it or not.",
  "Betty Botter bought some butter, but the butter was bitter.",
  "A proper copper coffee pot sits on the kitchen shelf.",
  "Red lorry, yellow lorry, red lorry, yellow lorry.",
  "Around the rugged rocks the ragged rascal ran.",
  "Fresh French fried fish flesh.",
  "Which witch switched the Swiss wristwatches?",
  "Six slippery snails slid slowly seaward.",
  "The black bloke's back brake block broke.",
  "Can you can a can as a canner can can a can?",
  "I scream, you scream, we all scream for ice cream.",
  "She thought she saw a fish on the dish that she wished she had finished.",
  "A big black bug bit a big black bear.",
  "How can a clam cram in a clean cream can?",
];

function pickRandom(current: string): string {
  const pool = SENTENCES.filter((s) => s !== current);
  return pool[Math.floor(Math.random() * pool.length)];
}

export default function Home() {
  const [targetText, setTargetText] = useState(SENTENCES[0]);
  const [draft, setDraft] = useState(SENTENCES[0]);
  const [isEditing, setIsEditing] = useState(false);
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
      fluencyScore: analysis.fluencyScore,
      tags: analysis.tags,
      wordTimestamps: analysis.wordTimestamps ?? [],
    });
    await saveAudio(id, audioBlob);
    setHistoryKey((k) => k + 1);
  }

  function shuffle() {
    const next = pickRandom(targetText);
    setTargetText(next);
  }

  function startEditing() {
    setDraft(targetText);
    setIsEditing(true);
  }

  function confirmEdit() {
    const trimmed = draft.trim();
    if (trimmed) setTargetText(trimmed);
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
          <div className="flex items-start justify-between gap-2">
            <p className="flex-1 text-base font-medium leading-relaxed text-zinc-700">{targetText}</p>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={shuffle}
                aria-label="Random sentence"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 active:bg-zinc-200"
              >
                <ShuffleIcon />
              </button>
              <button
                onClick={startEditing}
                aria-label="Edit sentence"
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 active:bg-zinc-200"
              >
                <PencilIcon />
              </button>
            </div>
          </div>
        )}

        {!isEditing && <Recorder targetText={targetText} onResult={handleResult} />}
      </section>

      {/* History */}
      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-zinc-400">History</h2>
        <HistoryList key={historyKey} />
      </section>
    </main>
  );
}

function ShuffleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4h5l2 3M4 20h5l7-8-7-8H4M15 4h5v4h-5M15 20h5v-4h-5M15 8l2 4-2 4" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2a2 2 0 01.586-1.414z" />
    </svg>
  );
}
