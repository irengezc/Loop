"use client";

import { useRef, useState } from "react";
import type { AnalysisResult } from "@/lib/types";

type Status = "idle" | "recording" | "processing";

interface Props {
  targetText: string;
  onResult: (result: AnalysisResult, audioBlob: Blob) => void;
}

export function Recorder({ targetText, onResult }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access denied.");
      return;
    }

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      await submit(blob);
    };

    recorderRef.current = recorder;
    recorder.start();
    setStatus("recording");
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setStatus("processing");
  }

  async function submit(audio: Blob) {
    const body = new FormData();
    body.append("audio", audio, "recording.webm");
    body.append("targetText", targetText);

    try {
      const res = await fetch("/api/analyze", { method: "POST", body });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const result = (await res.json()) as AnalysisResult;
      onResult(result, audio);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setStatus("idle");
    }
  }

  const isRecording = status === "recording";
  const isProcessing = status === "processing";

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={isProcessing}
        aria-label={isRecording ? "Stop recording" : "Start recording"}
        className={[
          "flex h-20 w-20 items-center justify-center rounded-full text-white transition-colors",
          isRecording
            ? "animate-pulse bg-red-500 active:bg-red-600"
            : isProcessing
            ? "cursor-not-allowed bg-zinc-400"
            : "bg-indigo-600 active:bg-indigo-700",
        ].join(" ")}
      >
        {isRecording ? (
          <StopIcon />
        ) : isProcessing ? (
          <SpinnerIcon />
        ) : (
          <MicIcon />
        )}
      </button>

      <p className="text-sm text-zinc-500">
        {isRecording
          ? "Recording — tap to stop"
          : isProcessing
          ? "Analyzing…"
          : "Tap to record"}
      </p>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}

function MicIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 10a7 7 0 01-14 0M12 19v4M8 23h8" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
