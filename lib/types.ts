export interface PronunciationIssue {
  word: string;
  startIndex: number;
  endIndex: number;
  type: "substitution" | "deletion" | "insertion" | "mispronunciation" | "stress";
  hint: string;
  severity: "low" | "medium" | "high";
}

export interface AnalysisResult {
  targetText: string;
  transcript: string;
  issues: PronunciationIssue[];
  tags: string[];
  fluencyScore: number; // 0–100
}

// Stored in localStorage
export interface PronunciationAttempt {
  id: string;
  createdAt: string; // ISO string
  targetText: string;
  transcript: string;
  feedback: PronunciationIssue[];
  topTag: string;
}
