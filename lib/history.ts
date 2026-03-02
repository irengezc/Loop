import type { PronunciationAttempt } from "@/lib/types";

const HISTORY_KEY = "pronunciation-history-v1";
const MAX_ATTEMPTS = 50;

export function loadAttempts(): PronunciationAttempt[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PronunciationAttempt[];
  } catch {
    return [];
  }
}

export function saveAttempt(attempt: PronunciationAttempt): void {
  if (typeof window === "undefined") return;
  try {
    const existing = loadAttempts();
    const updated = [attempt, ...existing].slice(0, MAX_ATTEMPTS);
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // ignore write failures
  }
}
