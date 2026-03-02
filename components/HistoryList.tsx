"use client";

import { useEffect, useRef, useState } from "react";
import { loadAttempts } from "@/lib/history";
import { loadAudio } from "@/lib/audioStore";
import type { PronunciationAttempt, PronunciationIssue, WordTimestamp } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

interface DiffWord {
  word: string;       // word from transcript
  wrong: boolean;
  issue: PronunciationIssue | null; // matched API issue, if any
}

/**
 * LCS-based word diff between targetText and transcript.
 * Returns each transcript word tagged as correct or wrong,
 * with the matching API issue attached where available.
 */
function diffTranscript(
  targetText: string,
  transcript: string,
  issues: PronunciationIssue[]
): DiffWord[] {
  const tw = targetText.split(/\s+/).filter(Boolean);
  const rw = transcript.split(/\s+/).filter(Boolean);
  const m = tw.length, n = rw.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = normalize(tw[i - 1]) === normalize(rw[j - 1])
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  // Backtrack — only emit transcript words (deletions from target are silent)
  const result: DiffWord[] = [];
  let i = m, j = n;
  while (j > 0) {
    if (i > 0 && normalize(tw[i - 1]) === normalize(rw[j - 1])) {
      result.unshift({ word: rw[j - 1], wrong: false, issue: null });
      i--; j--;
    } else if (i > 0 && dp[i - 1][j] >= dp[i][j - 1]) {
      i--; // target word deleted — skip silently
    } else {
      // transcript word has no match → wrong
      const matchedIssue = i > 0
        ? issues.find((iss) => normalize(iss.word) === normalize(tw[i - 1])) ?? null
        : null;
      result.unshift({ word: rw[j - 1], wrong: true, issue: matchedIssue });
      j--;
    }
  }
  return result;
}

/** Find the best timestamp for an issue word, with position-based fallback. */
function findTimestamp(
  issue: PronunciationIssue,
  targetText: string,
  wordTimestamps: WordTimestamp[]
): WordTimestamp | null {
  if (!wordTimestamps.length) return null;
  const exact = wordTimestamps.find((t) => normalize(t.word) === normalize(issue.word));
  if (exact) return exact;
  const textBefore = targetText.slice(0, issue.startIndex).trim();
  const wordIndex = textBefore === "" ? 0 : textBefore.split(/\s+/).length;
  return wordTimestamps[Math.min(wordIndex, wordTimestamps.length - 1)] ?? null;
}

const WORD_PAD = 0.15; // seconds of padding before/after word boundary

async function sliceAudio(blob: Blob, start: number, end: number): Promise<AudioBuffer | null> {
  try {
    const ctx = new AudioContext();
    const full = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close();
    const paddedStart = Math.max(0, start - WORD_PAD);
    const paddedEnd = Math.min(full.duration, end + WORD_PAD);
    const duration = Math.max(paddedEnd - paddedStart, 0.1);
    const offCtx = new OfflineAudioContext(
      full.numberOfChannels,
      Math.ceil(duration * full.sampleRate),
      full.sampleRate
    );
    const src = offCtx.createBufferSource();
    src.buffer = full;
    src.connect(offCtx.destination);
    src.start(0, paddedStart, duration);
    return offCtx.startRendering();
  } catch {
    return null;
  }
}

// ─── Severity colours ─────────────────────────────────────────────────────────

const severityRing: Record<PronunciationIssue["severity"], string> = {
  high: "underline decoration-red-500 decoration-2 text-red-600",
  medium: "underline decoration-orange-400 decoration-2 text-orange-600",
  low: "underline decoration-yellow-400 decoration-2 text-yellow-600",
};

// ─── Play buttons ─────────────────────────────────────────────────────────────

type PlayState = "idle" | "loading" | "playing";

/** Icon-only play button for full-sentence audio. */
function PlayButton({ getBlob }: { getBlob: () => Promise<Blob | null> }) {
  const [state, setState] = useState<PlayState>("idle");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setState("idle");
  }

  async function toggle() {
    if (state === "playing") { stop(); return; }
    setState("loading");
    try {
      const blob = await getBlob();
      if (!blob) { setState("idle"); return; }
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = stop;
      audio.onerror = stop;
      await audio.play();
      setState("playing");
    } catch { stop(); }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => stop, []);

  return (
    <button
      onClick={toggle}
      className={[
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors",
        state === "playing" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200",
        state === "loading" ? "cursor-wait opacity-60" : "",
      ].join(" ")}
    >
      {state === "playing" ? <StopIcon /> : state === "loading" ? <SpinnerIcon /> : <PlayIcon />}
    </button>
  );
}

/** Labeled play button for word-level audio inside the hint card. */
function WordButton({ label, state, onClick }: { label: string; state: PlayState; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={[
        "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
        state === "playing" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
        state === "loading" ? "cursor-wait opacity-60" : "",
      ].join(" ")}
    >
      {state === "playing" ? <StopIcon /> : state === "loading" ? <SpinnerIcon /> : <PlayIcon />}
      {label}
    </button>
  );
}

// ─── Highlighted transcript ───────────────────────────────────────────────────

function HighlightedTranscript({
  transcript,
  issues,
  targetText,
  wordTimestamps,
  attemptId,
}: {
  transcript: string;
  issues: PronunciationIssue[];
  targetText: string;
  wordTimestamps: WordTimestamp[];
  attemptId: string;
}) {
  // active is either an API issue or just a plain wrong word string
  const [activeIssue, setActiveIssue] = useState<PronunciationIssue | null>(null);
  const [activeWrongWord, setActiveWrongWord] = useState<string | null>(null);
  const [youState, setYouState] = useState<PlayState>("idle");
  const [nativeState, setNativeState] = useState<PlayState>("idle");
  const youSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const youCtxRef = useRef<AudioContext | null>(null);
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null);
  const nativeUrlRef = useRef<string | null>(null);

  const words = diffTranscript(targetText, transcript, issues);

  function stopYou() {
    youSrcRef.current?.stop();
    youSrcRef.current = null;
    youCtxRef.current?.close();
    youCtxRef.current = null;
    setYouState("idle");
  }

  function stopNative() {
    nativeAudioRef.current?.pause();
    nativeAudioRef.current = null;
    if (nativeUrlRef.current) { URL.revokeObjectURL(nativeUrlRef.current); nativeUrlRef.current = null; }
    setNativeState("idle");
  }

  function handleIssueClick(issue: PronunciationIssue) {
    stopYou(); stopNative();
    setActiveWrongWord(null);
    setActiveIssue((prev) => (prev === issue ? null : issue));
  }

  function handleWrongWordClick(word: string) {
    stopYou(); stopNative();
    setActiveIssue(null);
    setActiveWrongWord((prev) => (prev === word ? null : word));
  }

  async function toggleYouWord(ts: WordTimestamp) {
    if (youState === "playing") { stopYou(); return; }
    setYouState("loading");
    try {
      const blob = await loadAudio(attemptId);
      if (!blob) { setYouState("idle"); return; }
      const buffer = await sliceAudio(blob, ts.start, ts.end);
      if (!buffer) { setYouState("idle"); return; }
      const ctx = new AudioContext();
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(ctx.destination);
      src.onended = () => {
        youCtxRef.current?.close(); youCtxRef.current = null;
        youSrcRef.current = null; setYouState("idle");
      };
      src.start();
      youSrcRef.current = src;
      youCtxRef.current = ctx;
      setYouState("playing");
    } catch { setYouState("idle"); }
  }

  async function toggleNativeWord(word: string) {
    if (nativeState === "playing") { stopNative(); return; }
    setNativeState("loading");
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: word }),
      });
      if (!res.ok) { setNativeState("idle"); return; }
      const url = URL.createObjectURL(await res.blob());
      nativeUrlRef.current = url;
      const audio = new Audio(url);
      nativeAudioRef.current = audio;
      audio.onended = stopNative;
      audio.onerror = () => setNativeState("idle");
      await audio.play();
      setNativeState("playing");
    } catch { setNativeState("idle"); }
  }

  const activeTimestamp = activeIssue
    ? findTimestamp(activeIssue, targetText, wordTimestamps)
    : null;

  const hintWord = activeIssue?.word ?? activeWrongWord;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-relaxed text-zinc-600">
        {words.map((w, i) => {
          if (!w.wrong) return <span key={i}>{w.word}{" "}</span>;
          if (w.issue) return (
            <span key={i}>
              <button
                onClick={() => handleIssueClick(w.issue!)}
                className={[
                  "select-none cursor-pointer rounded px-0.5 transition-colors focus:outline-none",
                  severityRing[w.issue.severity],
                  activeIssue === w.issue ? "bg-red-50" : "",
                ].join(" ")}
              >
                {w.word}
              </button>
              {" "}
            </span>
          );
          return (
            <span key={i}>
              <button
                onClick={() => handleWrongWordClick(w.word)}
                className={[
                  "select-none cursor-pointer rounded px-0.5 transition-colors focus:outline-none",
                  "underline decoration-red-400 decoration-2 text-red-500",
                  activeWrongWord === w.word ? "bg-red-50" : "",
                ].join(" ")}
              >
                {w.word}
              </button>
              {" "}
            </span>
          );
        })}
      </p>

      {(activeIssue || activeWrongWord) && hintWord && (
        <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-zinc-800">
              &ldquo;{hintWord}&rdquo;
              {activeIssue && (
                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500 capitalize">
                  {activeIssue.type}
                </span>
              )}
            </p>
            <div className="flex gap-1.5">
              {activeTimestamp && (
                <WordButton label="You" state={youState} onClick={() => toggleYouWord(activeTimestamp)} />
              )}
              <WordButton label="Native" state={nativeState} onClick={() => toggleNativeWord(hintWord)} />
            </div>
          </div>
          <p className="mt-1 text-zinc-600">
            {activeIssue ? activeIssue.hint : "This word didn't match the original."}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function AttemptCard({ attempt }: { attempt: PronunciationAttempt }) {
  const getUserAudio = () => loadAudio(attempt.id);

  const getNativeAudio = async () => {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: attempt.targetText }),
    });
    if (!res.ok) return null;
    return res.blob();
  };

  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-400">{formatDate(attempt.createdAt)}</span>
        <div className="flex items-center gap-2">
          {attempt.fluencyScore != null && (
            <span className="text-xs font-semibold text-indigo-600">{attempt.fluencyScore}/100</span>
          )}
          {attempt.topTag && (
            <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
              {attempt.topTag}
            </span>
          )}
        </div>
      </div>

      {/* Original sentence + native play */}
      <div className="flex items-start gap-3">
        <p className="flex-1 text-sm font-medium leading-relaxed text-zinc-800">
          {attempt.targetText}
        </p>
        <PlayButton getBlob={getNativeAudio} />
      </div>

      <div className="border-t border-zinc-100" />

      {/* User transcript + user play */}
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <HighlightedTranscript
            transcript={attempt.transcript || "—"}
            issues={attempt.feedback}
            targetText={attempt.targetText}
            wordTimestamps={attempt.wordTimestamps ?? []}
            attemptId={attempt.id}
          />
        </div>
        <PlayButton getBlob={getUserAudio} />
      </div>
    </li>
  );
}

// ─── List ─────────────────────────────────────────────────────────────────────

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

// ─── Icons ────────────────────────────────────────────────────────────────────

function PlayIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}
function StopIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>;
}
function SpinnerIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>;
}
