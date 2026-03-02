"use client";

import { useEffect, useState } from "react";
import { loadAttempts } from "@/lib/history";
import type { PronunciationAttempt } from "@/lib/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function AttemptCard({ attempt }: { attempt: PronunciationAttempt }) {
  const issueCount = attempt.feedback.length;

  return (
    <li className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-400">{formatDate(attempt.createdAt)}</span>
        {attempt.topTag && (
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
            {attempt.topTag}
          </span>
        )}
      </div>

      <p className="text-sm font-medium text-zinc-800 leading-snug">{attempt.targetText}</p>

      <p className="text-sm text-zinc-500 leading-snug">
        <span className="mr-1 text-zinc-400">You said:</span>
        {attempt.transcript || <em className="text-zinc-300">—</em>}
      </p>

      <p className="text-xs text-zinc-400">
        {issueCount === 0 ? "No issues" : `${issueCount} issue${issueCount > 1 ? "s" : ""}`}
      </p>
    </li>
  );
}

export function HistoryList() {
  const [attempts, setAttempts] = useState<PronunciationAttempt[]>([]);

  useEffect(() => {
    setAttempts(loadAttempts());
  }, []);

  if (attempts.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-400">
        No attempts yet. Record your first sentence above.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {attempts.map((attempt) => (
        <AttemptCard key={attempt.id} attempt={attempt} />
      ))}
    </ul>
  );
}
