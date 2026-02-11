"use client";

import type { ReactNode } from "react";

type Segment = { type: "same" | "edit"; original: string; corrected: string };

/** Word-level diff for AI-editor style: corrected in blue, original in grey. */
function diffWords(original: string, corrected: string): Segment[] {
  const o = original.trim().split(/\s+/).filter(Boolean);
  const c = corrected.trim().split(/\s+/).filter(Boolean);
  const result: Segment[] = [];
  let i = 0;
  let j = 0;

  while (i < o.length || j < c.length) {
    if (i < o.length && j < c.length && o[i] === c[j]) {
      result.push({ type: "same", original: o[i], corrected: c[j] });
      i++;
      j++;
      continue;
    }
    const oStart = i;
    const cStart = j;
    // Advance until we find a match or run out
    while (i < o.length || j < c.length) {
      const oCur = i < o.length ? o[i] : null;
      const cCur = j < c.length ? c[j] : null;
      if (oCur !== null && cCur !== null && oCur === cCur) break;
      if (i < o.length) i++;
      if (j < c.length) j++;
    }
    const oSlice = o.slice(oStart, i).join(" ");
    const cSlice = c.slice(cStart, j).join(" ");
    if (oSlice || cSlice) {
      result.push({ type: "edit", original: oSlice, corrected: cSlice });
    }
  }

  if (result.length === 0 && (original.trim() || corrected.trim())) {
    result.push({ type: "edit", original: original.trim(), corrected: corrected.trim() });
  }
  return result;
}

export function EditorDiff({
  original,
  corrected,
  className = "",
}: {
  original: string;
  corrected: string;
  className?: string;
}): ReactNode {
  const segments = diffWords(original, corrected);

  return (
    <span className={className}>
      {segments.map((seg, idx) => {
        if (seg.type === "same") {
          return <span key={idx}>{seg.corrected} </span>;
        }
        return (
          <span key={idx} className="inline">
            <span className="font-medium text-sky-600 dark:text-sky-400">
              {seg.corrected}
            </span>
            {seg.original && seg.original !== seg.corrected && (
              <span className="ml-1.5 text-zinc-400 dark:text-zinc-500">
                {seg.original}
              </span>
            )}
            {" "}
          </span>
        );
      })}
    </span>
  );
}
