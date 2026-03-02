"use client";

import { useState } from "react";
import type { PronunciationIssue } from "@/lib/types";

interface Props {
  targetText: string;
  issues: PronunciationIssue[];
}

interface Segment {
  text: string;
  issue: PronunciationIssue | null;
}

function buildSegments(targetText: string, issues: PronunciationIssue[]): Segment[] {
  const sorted = [...issues].sort((a, b) => a.startIndex - b.startIndex);
  const segments: Segment[] = [];
  let cursor = 0;

  for (const issue of sorted) {
    const start = Math.max(issue.startIndex, cursor);
    const end = Math.min(issue.endIndex, targetText.length);
    if (start >= end) continue;

    if (cursor < start) {
      segments.push({ text: targetText.slice(cursor, start), issue: null });
    }
    segments.push({ text: targetText.slice(start, end), issue });
    cursor = end;
  }

  if (cursor < targetText.length) {
    segments.push({ text: targetText.slice(cursor), issue: null });
  }

  return segments;
}

const severityRing: Record<PronunciationIssue["severity"], string> = {
  high: "underline decoration-red-500 decoration-2 text-red-600",
  medium: "underline decoration-orange-400 decoration-2 text-orange-600",
  low: "underline decoration-yellow-400 decoration-2 text-yellow-600",
};

export function HighlightedSentence({ targetText, issues }: Props) {
  const [activeIssue, setActiveIssue] = useState<PronunciationIssue | null>(null);
  const segments = buildSegments(targetText, issues);

  function handleWordClick(issue: PronunciationIssue) {
    setActiveIssue((prev) => (prev === issue ? null : issue));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-lg leading-relaxed">
        {segments.map((seg, i) =>
          seg.issue ? (
            <button
              key={i}
              onClick={() => handleWordClick(seg.issue!)}
              className={[
                "rounded px-0.5 transition-colors focus:outline-none",
                severityRing[seg.issue.severity],
                activeIssue === seg.issue ? "bg-red-50" : "hover:bg-zinc-100",
              ].join(" ")}
            >
              {seg.text}
            </button>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </p>

      {activeIssue && (
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <p className="font-medium text-zinc-800">
            &ldquo;{activeIssue.word}&rdquo;
            <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500 capitalize">
              {activeIssue.type}
            </span>
          </p>
          <p className="mt-1 text-zinc-600">{activeIssue.hint}</p>
        </div>
      )}
    </div>
  );
}
