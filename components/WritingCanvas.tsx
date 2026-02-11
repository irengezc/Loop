"use client";

import { useLayoutEffect, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { EditorDiff } from "@/components/EditorDiff";
import {
  appendMistakes,
  loadDocumentText,
  saveDocumentText,
  type GrammarIssue,
} from "@/lib/mistakes";

type SentenceChunk = {
  text: string;
  key: string;
};

type AnalysisState =
  | { status: "idle" }
  | { status: "analyzing" }
  | { status: "error"; message: string }
  | { status: "done" };

type FragmentPair = { originalFragment: string; correctedFragment: string };

function levenshtein(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[] = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      if (s[i - 1] === t[j - 1]) {
        dp[j] = prev;
      } else {
        dp[j] = Math.min(prev + 1, dp[j] + 1, dp[j - 1] + 1);
      }
      prev = temp;
    }
  }
  return dp[n];
}

// Return one pair per contiguous run of changed words between original and corrected.
function diffFragmentsMulti(original: string, corrected: string): FragmentPair[] {
  const o = original.trim().split(/\s+/);
  const c = corrected.trim().split(/\s+/);

  if (o.join(" ") === c.join(" ")) {
    return [{ originalFragment: original, correctedFragment: corrected }];
  }

  const result: FragmentPair[] = [];

  let start = 0;
  while (start < o.length && start < c.length && o[start] === c[start]) {
    start++;
  }

  let oEnd = o.length - 1;
  let cEnd = c.length - 1;
  while (oEnd >= start && cEnd >= start && o[oEnd] === c[cEnd]) {
    oEnd--;
    cEnd--;
  }

  // Now we know that differences are within [start, oEnd] / [start, cEnd].
  // Walk this window and break into contiguous runs where words differ.
  let runStart: number | null = null;
  const windowEnd = Math.max(oEnd, cEnd);

  for (let i = start; i <= windowEnd; i++) {
    const ow = i <= oEnd ? o[i] : null;
    const cw = i <= cEnd ? c[i] : null;
    const isDiff = ow !== cw;

    if (isDiff && runStart === null) {
      runStart = i;
    } else if (!isDiff && runStart !== null) {
      const oSlice =
        runStart <= oEnd ? o.slice(runStart, Math.min(i, oEnd + 1)) : [];
      const cSlice =
        runStart <= cEnd ? c.slice(runStart, Math.min(i, cEnd + 1)) : [];
      if (oSlice.length || cSlice.length) {
        result.push({
          originalFragment: oSlice.join(" ") || original,
          correctedFragment: cSlice.join(" ") || corrected,
        });
      }
      runStart = null;
    }
  }

  if (runStart !== null) {
    const oSlice =
      runStart <= oEnd ? o.slice(runStart, oEnd + 1) : [];
    const cSlice =
      runStart <= cEnd ? c.slice(runStart, cEnd + 1) : [];
    if (oSlice.length || cSlice.length) {
      result.push({
        originalFragment: oSlice.join(" ") || original,
        correctedFragment: cSlice.join(" ") || corrected,
      });
    }
  }

  if (result.length === 0) {
    return [{ originalFragment: original, correctedFragment: corrected }];
  }

  return result;
}

function guessMistakeLabel(
  issue: GrammarIssue,
  originalFragment: string,
  correctedFragment: string
): string {
  const base = (issue.mistakeType || "Other").trim();
  const lower = base.toLowerCase();
  if (lower.includes("spelling") || lower.includes("typo")) {
    return "Spelling";
  }

  const oTokens = originalFragment.trim().split(/\s+/).filter(Boolean);
  const cTokens = correctedFragment.trim().split(/\s+/).filter(Boolean);

  if (oTokens.length === 1 && cTokens.length === 1) {
    const dist = levenshtein(oTokens[0], cTokens[0]);
    if (dist > 0 && dist <= 2) {
      return "Spelling";
    }
  }

  return base || "Other";
}

function splitIntoSentences(text: string): SentenceChunk[] {
  if (!text) return [];
  const chunks: SentenceChunk[] = [];
  let current = "";
  let keyIndex = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    current += ch;
    if (/[.!?…]/.test(ch)) {
      // include trailing spaces/newlines with this sentence
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) {
        current += text[j];
        j++;
        i = j - 1;
      }
      chunks.push({ text: current, key: `s-${keyIndex++}` });
      current = "";
    }
  }

  if (current) {
    chunks.push({ text: current, key: `s-${keyIndex++}` });
  }
  return chunks;
}

export function WritingCanvas() {
  const [content, setContent] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: "idle" });
  const [lastAnalyzedText, setLastAnalyzedText] = useState("");
  const [issues, setIssues] = useState<GrammarIssue[]>([]);
  const [showComments, setShowComments] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState<{
    issue: GrammarIssue;
    originalFragment: string;
    correctedFragment: string;
  } | null>(null);
  const [suggestionPos, setSuggestionPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const sentenceRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [commentPositions, setCommentPositions] = useState<Record<string, number>>({});
  const [rewrites, setRewrites] = useState<Record<string, string>>({});
  const [activeCommentSentence, setActiveCommentSentence] = useState<string | null>(null);
  const [showEditing, setShowEditing] = useState(true);

  // Load persisted document on mount
  useEffect(() => {
    const initial = loadDocumentText();
    if (initial) {
      setContent(initial);
    }
  }, []);

  // Auto-save on every change
  useEffect(() => {
    saveDocumentText(content);
  }, [content]);

  // Auto-size the textarea so the page scrolls naturally and overlay matches height
  useEffect(() => {
    const el = textAreaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = el.scrollHeight || 0;
    el.style.height = `${Math.max(next, 240)}px`;
  }, [content]);

  // Clear active issue when content or analysis changes significantly
  useEffect(() => {
    setActiveSuggestion(null);
    setSuggestionPos(null);
    setActiveCommentSentence(null);
  }, [content, analysis.status]);

  // Measure sentence positions so comments can be top-aligned
  useLayoutEffect(() => {
    if (!showComments || !hasIssues || !scrollContainerRef.current) return;
    const container = scrollContainerRef.current;
    const newPositions: Record<string, number> = {};
    const seenSentences = new Set<string>();
    for (const issue of issues) {
      if (!issue.sentence || seenSentences.has(issue.sentence)) continue;
      seenSentences.add(issue.sentence);
      const key = issue.sentence.trim();
      const matchingChunk = sentenceChunks.find((c) =>
        c.text.includes(issue.sentence) || issue.sentence.includes(c.text.trim())
      );
      const chunkKey = matchingChunk?.text.trim();
      const sentenceEl = chunkKey ? sentenceRefs.current[chunkKey] : null;
      if (sentenceEl) {
        const rect = sentenceEl.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        newPositions[issue.sentence] = rect.top - containerRect.top + container.scrollTop;
      }
    }
    setCommentPositions(newPositions);
  }, [showComments, hasIssues, issues, sentenceChunks, content]);

  // Update comment positions on scroll/resize when comments are shown
  useEffect(() => {
    if (!showComments || !hasIssues) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const update = () => {
      if (!container) return;
      const newPositions: Record<string, number> = {};
      const seenSentences = new Set<string>();
      for (const issue of issues) {
        if (!issue.sentence || seenSentences.has(issue.sentence)) continue;
        seenSentences.add(issue.sentence);
        const matchingChunk = sentenceChunks.find((c) =>
          c.text.includes(issue.sentence) || issue.sentence.includes(c.text.trim())
        );
        const chunkKey = matchingChunk?.text.trim();
        const sentenceEl = chunkKey ? sentenceRefs.current[chunkKey] : null;
        if (sentenceEl) {
          const rect = sentenceEl.getBoundingClientRect();
          const containerRect = container.getBoundingClientRect();
          newPositions[issue.sentence] = rect.top - containerRect.top + container.scrollTop;
        }
      }
      setCommentPositions((prev) => {
        const next = { ...prev, ...newPositions };
        return Object.keys(next).length !== Object.keys(prev).length ||
          Object.keys(next).some((k) => prev[k] !== next[k])
          ? next
          : prev;
      });
    };
    container.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      container.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [showComments, hasIssues, issues, sentenceChunks]);

  // When comments are visible, fetch more-natural rewrites per sentence (once).
  useEffect(() => {
    if (!showComments || !issues.length) return;

    const controller = new AbortController();

    (async () => {
      for (const issue of issues) {
        const key = issue.sentence;
        if (!key || rewrites[key] || controller.signal.aborted) continue;
        try {
          const res = await fetch("/api/rewrite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: issue.correctedSentence || issue.sentence }),
            signal: controller.signal,
          });
          const body = (await res.json().catch(() => ({}))) as {
            rewrite?: string;
          };
          if (res.ok && typeof body.rewrite === "string" && body.rewrite.trim()) {
            setRewrites((prev) => ({
              ...prev,
              [key]: body.rewrite!.trim(),
            }));
          }
        } catch {
          // best-effort; ignore failures
        }
      }
    })();

    return () => controller.abort();
  }, [showComments, issues, rewrites]);

  // Pause-based grammar analysis
  useEffect(() => {
    if (!content.trim()) {
      setAnalysis({ status: "idle" });
      setLastAnalyzedText("");
      setIssues([]);
      return;
    }

    // Only run if text actually changed since last analysis
    if (content === lastAnalyzedText) return;

    const handle = window.setTimeout(async () => {
      setAnalysis({ status: "analyzing" });
      try {
        const isAppend =
          lastAnalyzedText.length > 0 && content.startsWith(lastAnalyzedText);
        const textToCheck = isAppend
          ? content.slice(lastAnalyzedText.length)
          : content;

        if (!textToCheck.trim()) {
          setAnalysis({ status: "done" });
          setLastAnalyzedText(content);
          return;
        }

        const res = await fetch("/api/grammar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: textToCheck }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          issues?: GrammarIssue[];
          error?: string;
        };
        if (!res.ok) {
          setAnalysis({
            status: "error",
            message:
              (body?.error as string) ??
              `Grammar analysis failed (${res.status})`,
          });
          return;
        }
        const newIssues =
          Array.isArray(body.issues) && body.issues.length > 0
            ? body.issues
            : [];
        if (newIssues.length) {
          setIssues((prev) => {
            const combined = [...prev, ...newIssues];
            const seen = new Set<string>();
            const deduped: GrammarIssue[] = [];
            for (const it of combined) {
              const key = `${it.sentence}:::${it.correctedSentence}:::${it.explanation}`;
              if (seen.has(key)) continue;
              seen.add(key);
              deduped.push(it);
            }
            return deduped;
          });
          appendMistakes(newIssues);
        }
        setAnalysis({ status: "done" });
        setLastAnalyzedText(content);
      } catch (e) {
        setAnalysis({
          status: "error",
          message:
            e instanceof Error ? e.message : "Grammar analysis failed unexpectedly.",
        });
      }
    }, 1500); // 1.5s pause

    return () => window.clearTimeout(handle);
  }, [content, lastAnalyzedText]);

  const sentenceChunks = useMemo(() => splitIntoSentences(content), [content]);

  const hasIssues = issues.length > 0;

  return (
    <div className="relative flex gap-6">
      {/* Main writing column – always uses full content width */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <header className="flex items-center justify-between gap-4">
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            <p className="font-medium">Today&apos;s writing</p>
          </div>
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {showComments ? "Hide comments" : "Show comments"}
          </button>
        </header>

        <section className="flex flex-col gap-2">
          {showComments && hasIssues ? (
          <>
          {/* Scrollable row: canvas + comments top-aligned with sentences */}
          <div
            ref={scrollContainerRef}
            className="flex gap-6 min-h-[50vh] max-h-[70vh] overflow-auto"
          >
            <div className="min-w-0 flex-1">
          {/* Free-style canvas: textarea input + overlay for hints */}
          <div className="relative w-full text-lg leading-relaxed">
            <textarea
              ref={textAreaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write freely here. Feedback will appear softly under your words after you pause…"
              className="relative z-0 block w-full resize-none bg-transparent px-0 py-0 text-lg leading-relaxed text-transparent caret-zinc-800 outline-none"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              aria-label="Writing canvas"
            />
            <div
              className="pointer-events-none absolute inset-0 z-10 w-full whitespace-pre-wrap text-lg leading-relaxed text-zinc-800 dark:text-zinc-100"
              aria-hidden="true"
            >
              {content.trim().length === 0 && (
                <span className="text-zinc-400/70 dark:text-zinc-500/70">
                  Write freely here. Feedback will appear softly under your words after you pause…
                </span>
              )}
              {sentenceChunks.length === 0 && content}
              {sentenceChunks.map((chunk) => {
                const normalizedChunk = chunk.text.trim();
                const matchingIssues: GrammarIssue[] = [];
                if (hasIssues) {
                  for (const issue of issues) {
                    if (chunk.text.includes(issue.sentence)) {
                      matchingIssues.push(issue);
                    }
                  }
                }

                if (!matchingIssues.length) {
                  return <span key={chunk.key}>{chunk.text}</span>;
                }

                // One visual highlight per changed fragment
                type Highlight = {
                  start: number;
                  end: number;
                  issue: GrammarIssue;
                  originalFragment: string;
                  correctedFragment: string;
                };
                const highlights: Highlight[] = [];

                for (const issue of matchingIssues) {
                  const sentenceText = issue.sentence;
                  const baseSentenceIndex = chunk.text.indexOf(sentenceText);

                  const fragmentPairs = diffFragmentsMulti(
                    issue.sentence,
                    issue.correctedSentence
                  );

                  for (const pair of fragmentPairs) {
                    const fragment = pair.originalFragment.trim();
                    if (!fragment) continue;

                    let startInSentence = sentenceText.indexOf(fragment);

                    // Fallback: if we can't find the fragment in the sentence, try in the chunk
                    if (baseSentenceIndex === -1 && fragment) {
                      const altIndex = chunk.text.indexOf(fragment);
                      if (altIndex !== -1) {
                        highlights.push({
                          start: altIndex,
                          end: altIndex + fragment.length,
                          issue,
                          originalFragment: pair.originalFragment,
                          correctedFragment: pair.correctedFragment,
                        });
                        continue;
                      }
                    }

                    if (baseSentenceIndex === -1) continue;

                    if (startInSentence === -1) {
                      highlights.push({
                        start: baseSentenceIndex,
                        end: baseSentenceIndex + sentenceText.length,
                        issue,
                        originalFragment: pair.originalFragment,
                        correctedFragment: pair.correctedFragment,
                      });
                      continue;
                    }

                    const fragStart = baseSentenceIndex + startInSentence;
                    const fragEnd = fragStart + fragment.length;
                    highlights.push({
                      start: fragStart,
                      end: fragEnd,
                      issue,
                      originalFragment: pair.originalFragment,
                      correctedFragment: pair.correctedFragment,
                    });
                  }
                }

                if (!highlights.length) {
                  return <span key={chunk.key}>{chunk.text}</span>;
                }

                // Sort by start; remove overlaps to avoid duplicated text display.
                // When overlapping, prefer the larger span (covers full repeated typo).
                highlights.sort((a, b) => a.start - b.start);
                const filteredHighlights: Highlight[] = [];
                for (const h of highlights) {
                  const overlaps = filteredHighlights.find(
                    (f) => h.start < f.end && h.end > f.start
                  );
                  if (overlaps) {
                    // If this span is larger, replace the overlapping one
                    const hLen = h.end - h.start;
                    const oLen = overlaps.end - overlaps.start;
                    if (hLen > oLen) {
                      filteredHighlights.splice(filteredHighlights.indexOf(overlaps), 1, h);
                    }
                    // else skip this smaller overlap
                  } else {
                    filteredHighlights.push(h);
                  }
                }
                filteredHighlights.sort((a, b) => a.start - b.start);

                const parts: ReactNode[] = [];
                let cursor = 0;
                filteredHighlights.forEach((h, idx) => {
                  if (h.start > cursor) {
                    parts.push(
                      <span key={`${chunk.key}-plain-${idx}`}>
                        {chunk.text.slice(cursor, h.start)}
                      </span>
                    );
                  }
                  const text = chunk.text.slice(h.start, h.end);
                  const isFromActiveComment =
                    activeCommentSentence &&
                    h.issue.sentence === activeCommentSentence;
                  parts.push(
                    <span
                      key={`${chunk.key}-hl-${idx}`}
                      className={
                        "cursor-pointer rounded-sm underline underline-offset-[4px] [pointer-events:auto] " +
                        (isFromActiveComment
                          ? "bg-emerald-100/80 decoration-emerald-600 dark:bg-emerald-500/30 dark:decoration-emerald-300"
                          : "bg-amber-100/80 decoration-amber-500/90 dark:bg-amber-500/25 dark:decoration-amber-300/90")
                      }
                      title={h.issue.explanation}
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveSuggestion({
                          issue: h.issue,
                          originalFragment: h.originalFragment,
                          correctedFragment: h.correctedFragment,
                        });
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setSuggestionPos({
                          top: rect.bottom + 8,
                          left: rect.left + rect.width / 2,
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActiveSuggestion({
                            issue: h.issue,
                            originalFragment: h.originalFragment,
                            correctedFragment: h.correctedFragment,
                          });
                        }
                      }}
                    >
                      {text}
                    </span>
                  );
                  cursor = h.end;
                });
                if (cursor < chunk.text.length) {
                  parts.push(
                    <span key={`${chunk.key}-tail`}>
                      {chunk.text.slice(cursor)}
                    </span>
                  );
                }

                return (
                  <span
                    key={chunk.key}
                    ref={(el) => {
                      if (!el) return;
                      if (!normalizedChunk) return;
                      sentenceRefs.current[normalizedChunk] = el;
                    }}
                  >
                    {parts}
                  </span>
                );
              })}
            </div>
          </div>
            </div>
            {/* Comments column – each comment top-aligned with its sentence */}
            <div className="relative w-80 flex-shrink-0">
              <div className="sticky top-0 mb-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Comments
                </p>
              </div>
              <div className="relative min-h-[200px]">
                {(() => {
                  const seenSentences = new Set<string>();
                  return issues.map((issue, idx) => {
                    if (!issue.sentence || seenSentences.has(issue.sentence)) return null;
                    seenSentences.add(issue.sentence);
                    const top = commentPositions[issue.sentence];
                    const rewrite = rewrites[issue.sentence];
                    const isActive = activeCommentSentence === issue.sentence;
                    return (
                      <button
                        key={`${issue.sentence}-${idx}`}
                        type="button"
                        onClick={() => {
                          setActiveCommentSentence((prev) =>
                            prev === issue.sentence ? null : issue.sentence
                          );
                          const matchingChunk = sentenceChunks.find((c) =>
                            c.text.includes(issue.sentence) || issue.sentence.includes(c.text.trim())
                          );
                          const chunkKey = matchingChunk?.text.trim();
                          const target = chunkKey ? sentenceRefs.current[chunkKey] : null;
                          if (target) {
                            target.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }}
                        className={`absolute left-0 right-0 rounded-lg border p-2 text-left text-xs transition-colors ${
                          isActive
                            ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/40"
                            : "border-zinc-200 bg-zinc-50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900/60 dark:hover:border-zinc-600"
                        }`}
                        style={{ top: typeof top === "number" ? `${Math.max(0, top)}px` : "0" }}
                      >
                        {rewrite ? (
                          <p className="text-[11px] text-zinc-800 dark:text-zinc-100">"{rewrite}"</p>
                        ) : (
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">More natural version loading…</p>
                        )}
                      </button>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          </>
          ) : (
          /* Canvas only (no comments layout) – reuse same scroll wrapper for consistent ref/measure */
          <div ref={scrollContainerRef} className="flex gap-6">
            <div className="min-w-0 flex-1">
          <div className="relative w-full text-lg leading-relaxed">
            <textarea
              ref={textAreaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write freely here. Feedback will appear softly under your words after you pause…"
              className="relative z-0 block w-full resize-none bg-transparent px-0 py-0 text-lg leading-relaxed text-transparent caret-zinc-800 outline-none"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              aria-label="Writing canvas"
            />
            <div
              className="pointer-events-none absolute inset-0 z-10 w-full whitespace-pre-wrap text-lg leading-relaxed text-zinc-800 dark:text-zinc-100"
              aria-hidden="true"
            >
              {content.trim().length === 0 && (
                <span className="text-zinc-400/70 dark:text-zinc-500/70">
                  Write freely here. Feedback will appear softly under your words after you pause…
                </span>
              )}
              {sentenceChunks.length === 0 && content}
              {sentenceChunks.map((chunk) => {
                const normalizedChunk = chunk.text.trim();
                const matchingIssues: GrammarIssue[] = [];
                if (hasIssues) {
                  for (const issue of issues) {
                    if (chunk.text.includes(issue.sentence)) matchingIssues.push(issue);
                  }
                }
                if (!matchingIssues.length) return <span key={chunk.key}>{chunk.text}</span>;
                type Highlight = {
                  start: number;
                  end: number;
                  issue: GrammarIssue;
                  originalFragment: string;
                  correctedFragment: string;
                };
                const highlights: Highlight[] = [];
                for (const issue of matchingIssues) {
                  const sentenceText = issue.sentence;
                  const baseSentenceIndex = chunk.text.indexOf(sentenceText);
                  const fragmentPairs = diffFragmentsMulti(issue.sentence, issue.correctedSentence);
                  for (const pair of fragmentPairs) {
                    const fragment = pair.originalFragment.trim();
                    if (!fragment) continue;
                    let startInSentence = sentenceText.indexOf(fragment);
                    if (baseSentenceIndex === -1 && fragment) {
                      const altIndex = chunk.text.indexOf(fragment);
                      if (altIndex !== -1) {
                        highlights.push({
                          start: altIndex,
                          end: altIndex + fragment.length,
                          issue,
                          originalFragment: pair.originalFragment,
                          correctedFragment: pair.correctedFragment,
                        });
                        continue;
                      }
                    }
                    if (baseSentenceIndex === -1) continue;
                    if (startInSentence === -1) {
                      highlights.push({
                        start: baseSentenceIndex,
                        end: baseSentenceIndex + sentenceText.length,
                        issue,
                        originalFragment: pair.originalFragment,
                        correctedFragment: pair.correctedFragment,
                      });
                      continue;
                    }
                    const fragStart = baseSentenceIndex + startInSentence;
                    const fragEnd = fragStart + fragment.length;
                    highlights.push({
                      start: fragStart,
                      end: fragEnd,
                      issue,
                      originalFragment: pair.originalFragment,
                      correctedFragment: pair.correctedFragment,
                    });
                  }
                }
                if (!highlights.length) return <span key={chunk.key}>{chunk.text}</span>;
                highlights.sort((a, b) => a.start - b.start);
                const filteredHighlights: Highlight[] = [];
                for (const h of highlights) {
                  const overlaps = filteredHighlights.find((f) => h.start < f.end && h.end > f.start);
                  if (overlaps) {
                    const hLen = h.end - h.start;
                    const oLen = overlaps.end - overlaps.start;
                    if (hLen > oLen) {
                      filteredHighlights.splice(filteredHighlights.indexOf(overlaps), 1, h);
                    }
                  } else {
                    filteredHighlights.push(h);
                  }
                }
                filteredHighlights.sort((a, b) => a.start - b.start);
                const parts: ReactNode[] = [];
                let cursor = 0;
                filteredHighlights.forEach((h, idx) => {
                  if (h.start > cursor) {
                    parts.push(<span key={`${chunk.key}-plain-${idx}`}>{chunk.text.slice(cursor, h.start)}</span>);
                  }
                  const text = chunk.text.slice(h.start, h.end);
                  const isFromActiveComment = activeCommentSentence && h.issue.sentence === activeCommentSentence;
                  parts.push(
                    <span
                      key={`${chunk.key}-hl-${idx}`}
                      className={
                        "cursor-pointer rounded-sm underline underline-offset-[4px] [pointer-events:auto] " +
                        (isFromActiveComment
                          ? "bg-emerald-100/80 decoration-emerald-600 dark:bg-emerald-500/30 dark:decoration-emerald-300"
                          : "bg-amber-100/80 decoration-amber-500/90 dark:bg-amber-500/25 dark:decoration-amber-300/90")
                      }
                      title={h.issue.explanation}
                      role="button"
                      tabIndex={0}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveSuggestion({
                          issue: h.issue,
                          originalFragment: h.originalFragment,
                          correctedFragment: h.correctedFragment,
                        });
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        setSuggestionPos({ top: rect.bottom + 8, left: rect.left + rect.width / 2 });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setActiveSuggestion({
                            issue: h.issue,
                            originalFragment: h.originalFragment,
                            correctedFragment: h.correctedFragment,
                          });
                        }
                      }}
                    >
                      {text}
                    </span>
                  );
                  cursor = h.end;
                });
                if (cursor < chunk.text.length) {
                  parts.push(<span key={`${chunk.key}-tail`}>{chunk.text.slice(cursor)}</span>);
                }
                return (
                  <span
                    key={chunk.key}
                    ref={(el) => {
                      if (!el || !normalizedChunk) return;
                      sentenceRefs.current[normalizedChunk] = el;
                    }}
                  >
                    {parts}
                  </span>
                );
              })}
            </div>
          </div>
            </div>
          </div>
          )}

          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {analysis.status === "analyzing" && "Analyzing grammar in the background…"}
            {analysis.status === "idle" &&
              "Pause for a moment to see gentle grammar hints."}
            {analysis.status === "error" && (
              <span>
                Could not update feedback.{" "}
                <span className="font-medium text-amber-600 dark:text-amber-400" title="Server error">
                  ({analysis.message || "Unknown error"})
                </span>
                {" "}It will retry after you keep writing.
              </span>
            )}
            {analysis.status === "done" && !hasIssues &&
              "No major grammar issues detected. Keep going!"}
            {analysis.status === "done" && hasIssues &&
              `Found ${issues.length} potential issue${
                issues.length === 1 ? "" : "s"
              } from this session.`}
          </p>
        </section>
      </div>

      {/* Right-side comments panel – overlays in the free right margin without shrinking canvas */}
      {showComments && !hasIssues && (
        <aside className="hidden w-80 flex-shrink-0 lg:block">
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Comments
            </p>
          </div>
          {!hasIssues && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Grammar comments will appear here after you pause and we detect
              issues.
            </p>
          )}
          {hasIssues && (
            <ul className="flex flex-1 flex-col gap-2 overflow-y-auto text-xs">
              {(() => {
                const seenSentences = new Set<string>();
                return issues.map((issue, idx) => {
                  if (!issue.sentence || seenSentences.has(issue.sentence)) {
                    return null;
                  }
                  seenSentences.add(issue.sentence);

                  const rewrite = rewrites[issue.sentence];
                  const isActive = activeCommentSentence === issue.sentence;
                  return (
                    <button
                      key={`${issue.sentence}-${idx}`}
                      type="button"
                      onClick={() => {
                        setActiveCommentSentence((prev) =>
                          prev === issue.sentence ? null : issue.sentence
                        );
                        const key = issue.sentence.trim();
                        const target = sentenceRefs.current[key];
                        if (target) {
                          target.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                        }
                      }}
                      className={`rounded-lg border p-2 text-left ${
                        isActive
                          ? "border-emerald-500 bg-emerald-50 dark:border-emerald-400 dark:bg-emerald-900/40"
                          : "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/60"
                      }`}
                    >
                      {rewrite && (
                        <p className="text-[11px] text-zinc-800 dark:text-zinc-100">
                          “{rewrite}”
                        </p>
                      )}
                      {!rewrite && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          More natural version loading…
                        </p>
                      )}
                    </button>
                  );
                });
              })()}
            </ul>
          )}
        </aside>
      )}
      {/* Popup suggestion card when clicking an underline, shown near the sentence */}
      {activeSuggestion && suggestionPos && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setActiveSuggestion(null);
            setSuggestionPos(null);
          }}
        >
          <div
            className="absolute -translate-x-1/2"
            style={{ top: suggestionPos.top, left: suggestionPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
              const { originalFragment, correctedFragment, issue } = activeSuggestion;
              const label = guessMistakeLabel(
                issue,
                originalFragment,
                correctedFragment
              );
              return (
                <div className="max-w-sm rounded-xl border border-zinc-200 bg-white p-4 text-xs text-zinc-800 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">
                      Suggestion
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowEditing((v) => !v)}
                        className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      >
                        {showEditing ? "Hide" : "Show"} editing
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveSuggestion(null);
                          setSuggestionPos(null);
                        }}
                        className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  <p className="mb-1 text-[11px] font-semibold text-zinc-700 dark:text-zinc-100">
                    {label}
                  </p>
                  {showEditing ? (
                    <p className="mb-2 text-[11px]">
                      <EditorDiff original={originalFragment} corrected={correctedFragment} />
                    </p>
                  ) : (
                    <p className="mb-2 text-[11px] text-zinc-700 dark:text-zinc-200">
                      Replace “{originalFragment}” with “{correctedFragment}”
                    </p>
                  )}
                  <div className="my-2 h-px w-full bg-zinc-200 dark:bg-zinc-700" />
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-300">
                    {issue.explanation}
                  </p>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

