"use client";

import { useEffect, useRef, useState } from "react";
import { loadAttempts } from "@/lib/history";
import { loadAudio } from "@/lib/audioStore";
import type { PronunciationAttempt } from "@/lib/types";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
    " · " +
    d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })
  );
}

type PlayState = "idle" | "loading" | "playing";

function PlayButton({ label, getBlob }: { label: string; getBlob: () => Promise<Blob | null> }) {
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
        "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
        state === "playing" ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
        state === "loading" ? "cursor-wait opacity-60" : "",
      ].join(" ")}
    >
      {state === "playing" ? <StopIcon /> : state === "loading" ? <SpinnerIcon /> : <PlayIcon />}
      {label}
    </button>
  );
}

function AttemptCard({ attempt }: { attempt: PronunciationAttempt }) {
  const issueCount = attempt.feedback.length;

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
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-zinc-400">{formatDate(attempt.createdAt)}</span>
        {attempt.topTag && (
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-medium text-indigo-600">
            {attempt.topTag}
          </span>
        )}
      </div>

      <p className="text-sm font-medium leading-snug text-zinc-800">{attempt.targetText}</p>

      <p className="text-sm leading-snug text-zinc-500">
        <span className="text-zinc-400">You said: </span>
        {attempt.transcript || <em className="text-zinc-300">—</em>}
      </p>

      <p className="text-xs text-zinc-400">
        {issueCount === 0 ? "No issues" : `${issueCount} issue${issueCount > 1 ? "s" : ""}`}
      </p>

      <div className="flex gap-2">
        <PlayButton label="You" getBlob={getUserAudio} />
        <PlayButton label="Native" getBlob={getNativeAudio} />
      </div>
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

function PlayIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="1" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
