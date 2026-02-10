export type MistakeCategory =
  | "articles"
  | "tense"
  | "word_form"
  | "prepositions"
  | "agreement"
  | "other";

export interface GrammarIssue {
  sentence: string;
  correctedSentence: string;
  mistakeType: string;
  explanation: string;
}

export interface StoredMistake {
  id: string;
  sentence: string;
  correctedSentence: string;
  category: MistakeCategory;
  explanation: string;
  createdAt: string; // ISO string
}

const MISTAKES_KEY = "language-loop-mistakes-v1";
const DOCUMENT_KEY = "language-loop-document-v1";

export function normalizeCategory(input: string): MistakeCategory {
  const lower = input.toLowerCase();
  if (lower.includes("article")) return "articles";
  if (lower.includes("tense")) return "tense";
  if (lower.includes("word form") || lower.includes("form"))
    return "word_form";
  if (lower.includes("preposition")) return "prepositions";
  if (lower.includes("agreement") || lower.includes("subject-verb"))
    return "agreement";
  return "other";
}

export function loadMistakes(): StoredMistake[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MISTAKES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredMistake[];
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function appendMistakes(issues: GrammarIssue[]): void {
  if (typeof window === "undefined" || issues.length === 0) return;
  const existing = loadMistakes();
  const now = new Date().toISOString();

  const asStored: StoredMistake[] = issues.map((issue) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sentence: issue.sentence,
    correctedSentence: issue.correctedSentence,
    category: normalizeCategory(issue.mistakeType),
    explanation: issue.explanation,
    createdAt: now,
  }));

  const combined = dedupeMistakes([...existing, ...asStored]);
  try {
    window.localStorage.setItem(MISTAKES_KEY, JSON.stringify(combined));
  } catch {
    // Best-effort; ignore write failures for MVP
  }
}

function dedupeMistakes(list: StoredMistake[]): StoredMistake[] {
  const seen = new Set<string>();
  const result: StoredMistake[] = [];
  for (const m of list) {
    const key = `${m.sentence}:::${m.correctedSentence}:::${m.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(m);
  }
  return result;
}

export function loadDocumentText(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(DOCUMENT_KEY);
    return typeof raw === "string" ? raw : "";
  } catch {
    return "";
  }
}

export function saveDocumentText(text: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DOCUMENT_KEY, text);
  } catch {
    // Ignore for MVP
  }
}

