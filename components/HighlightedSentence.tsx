"use client";

import { useRef, useState } from "react";
import type { PronunciationIssue, WordTimestamp } from "@/lib/types";
import { loadAudio } from "@/lib/audioStore";

interface Props {
  targetText: string;
  issues: PronunciationIssue[];
  wordTimestamps?: WordTimestamp[];
  attemptId?: string;
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
    if (cursor < start) segments.push({ text: targetText.slice(cursor, start), issue: null });
    segments.push({ text: targetText.slice(start, end), issue });
    cursor = end;
  }
  if (cursor < targetText.length) segments.push({ text: targetText.slice(cursor), issue: null });
  return segments;
}

const severityRing: Record<PronunciationIssue["severity"], string> = {
  high: "underline decoration-red-500 decoration-2 text-red-600",
  medium: "underline decoration-orange-400 decoration-2 text-orange-600",
  low: "underline decoration-yellow-400 decoration-2 text-yellow-600",
};

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

async function sliceAudio(blob: Blob, start: number, end: number): Promise<AudioBuffer | null> {
  try {
    const ctx = new AudioContext();
    const full = await ctx.decodeAudioData(await blob.arrayBuffer());
    ctx.close();
    const duration = Math.max(end - start, 0.05);
    const offCtx = new OfflineAudioContext(
      full.numberOfChannels,
      Math.ceil(duration * full.sampleRate),
      full.sampleRate
    );
    const src = offCtx.createBufferSource();
    src.buffer = full;
    src.connect(offCtx.destination);
    src.start(0, start, duration);
    return offCtx.startRendering();
  } catch {
    return null;
  }
}

type WordPlayState = "idle" | "loading" | "playing";

export function HighlightedSentence({ targetText, issues, wordTimestamps, attemptId }: Props) {
  const [activeIssue, setActiveIssue] = useState<PronunciationIssue | null>(null);
  const [youState, setYouState] = useState<WordPlayState>("idle");
  const [nativeState, setNativeState] = useState<WordPlayState>("idle");

  const youSrcRef = useRef<AudioBufferSourceNode | null>(null);
  const youCtxRef = useRef<AudioContext | null>(null);
  const nativeAudioRef = useRef<HTMLAudioElement | null>(null);
  const nativeUrlRef = useRef<string | null>(null);

  const segments = buildSegments(targetText, issues);

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

  function handleWordClick(issue: PronunciationIssue) {
    if (activeIssue !== issue) { stopYou(); stopNative(); }
    setActiveIssue((prev) => (prev === issue ? null : issue));
  }

  async function toggleYouWord(word: string) {
    if (youState === "playing") { stopYou(); return; }
    if (!wordTimestamps?.length || !attemptId) return;
    const ts = wordTimestamps.find((t) => normalize(t.word) === normalize(word));
    if (!ts) return;
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
      src.onended = () => { youCtxRef.current?.close(); youCtxRef.current = null; youSrcRef.current = null; setYouState("idle"); };
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

  const hasWordAudio = !!wordTimestamps?.length && !!attemptId;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base leading-relaxed">
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
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium text-zinc-800">
              &ldquo;{activeIssue.word}&rdquo;
              <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-normal text-zinc-500 capitalize">
                {activeIssue.type}
              </span>
            </p>
            <div className="flex gap-1.5">
              {hasWordAudio && (
                <WordButton
                  label="You"
                  state={youState}
                  onClick={() => toggleYouWord(activeIssue.word)}
                />
              )}
              <WordButton
                label="Native"
                state={nativeState}
                onClick={() => toggleNativeWord(activeIssue.word)}
              />
            </div>
          </div>
          <p className="mt-1 text-zinc-600">{activeIssue.hint}</p>
        </div>
      )}
    </div>
  );
}

function WordButton({ label, state, onClick }: { label: string; state: WordPlayState; onClick: () => void }) {
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

function PlayIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>;
}
function StopIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1" /></svg>;
}
function SpinnerIcon() {
  return <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" /></svg>;
}
