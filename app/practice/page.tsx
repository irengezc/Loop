"use client";

import { useEffect, useMemo, useState } from "react";
import { ModeTabs } from "@/components/ModeTabs";
import { loadMistakes, type MistakeCategory, type StoredMistake } from "@/lib/mistakes";

type CategorySummary = {
  category: MistakeCategory;
  count: number;
};

type ExerciseKind = "fill_blank" | "choose_correct";

type Exercise = {
  kind: ExerciseKind;
  prompt: string;
  answer: string;
  options?: string[];
  explanation: string;
};

function buildExercise(mistake: StoredMistake, kind: ExerciseKind): Exercise {
  const originalWords = mistake.sentence.split(/\s+/);
  const correctedWords = mistake.correctedSentence.split(/\s+/);

  let differingIndex = correctedWords.findIndex(
    (w, i) => originalWords[i] && originalWords[i] !== w
  );
  if (differingIndex === -1) {
    differingIndex = Math.max(correctedWords.length - 1, 0);
  }

  const answer = correctedWords[differingIndex] ?? "";
  const promptWords = [...correctedWords];
  if (promptWords[differingIndex]) {
    promptWords[differingIndex] = "_____"; // simple blank
  }

  const prompt = promptWords.join(" ");

  if (kind === "fill_blank") {
    return {
      kind,
      prompt,
      answer,
      explanation: mistake.explanation,
    };
  }

  const options = Array.from(
    new Set(
      [
        answer,
        originalWords[differingIndex] ?? "",
        "the",
        "a",
      ].filter(Boolean)
    )
  ).slice(0, 4);

  return {
    kind,
    prompt,
    answer,
    options,
    explanation: mistake.explanation,
  };
}

function statusFromCount(count: number): "Weak" | "Improving" | "Stable" {
  if (count >= 10) return "Weak";
  if (count >= 4) return "Improving";
  return "Stable";
}

export default function PracticePage() {
  const [mistakes, setMistakes] = useState<StoredMistake[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<MistakeCategory | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [exerciseKind, setExerciseKind] = useState<ExerciseKind>("fill_blank");
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setMistakes(loadMistakes());
  }, []);

  const summaries: CategorySummary[] = useMemo(() => {
    const map = new Map<MistakeCategory, number>();
    for (const m of mistakes) {
      map.set(m.category, (map.get(m.category) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [mistakes]);

  const mistakesInCategory = useMemo(() => {
    if (!selectedCategory) return [];
    return mistakes.filter((m) => m.category === selectedCategory);
  }, [mistakes, selectedCategory]);

  const currentMistake =
    mistakesInCategory.length > 0
      ? mistakesInCategory[Math.min(activeIndex, mistakesInCategory.length - 1)]
      : null;

  const currentExercise = currentMistake
    ? buildExercise(currentMistake, exerciseKind)
    : null;

  const handleCheck = () => {
    if (!currentExercise) return;
    const normalizedAnswer = userAnswer.trim().toLowerCase();
    const normalizedCorrect = currentExercise.answer.trim().toLowerCase();
    const correct = normalizedAnswer === normalizedCorrect;

    if (correct) {
      setFeedback("Correct! Nice job using this pattern.");
    } else {
      setFeedback(
        `Not quite. The better choice here is "${currentExercise.answer}".`
      );
    }
  };

  const handleNext = () => {
    setFeedback(null);
    setUserAnswer("");
    if (mistakesInCategory.length === 0) return;
    setActiveIndex((prev) => (prev + 1) % mistakesInCategory.length);
  };

  return (
    <main className="mx-auto flex max-w-2xl flex-1 flex-col gap-8 bg-white px-6 py-16 dark:bg-zinc-900 sm:px-8 sm:py-24">
      <ModeTabs />
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">Practice</h1>
        <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
          Train on patterns we observed in your own writing. Choose a mistake
          type, see real examples, and practise with short, focused activities.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Mistake overview
        </h2>
        {summaries.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            We haven&apos;t detected any mistakes yet. Write freely on the Writing
            page and come back here to practise your own patterns.
          </p>
        )}
        {summaries.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {summaries.map((summary) => (
              <button
                key={summary.category}
                type="button"
                onClick={() => {
                  setSelectedCategory(summary.category);
                  setActiveIndex(0);
                  setFeedback(null);
                  setUserAnswer("");
                }}
                className={`flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left text-sm shadow-sm transition ${
                  selectedCategory === summary.category
                    ? "border-sky-500 bg-sky-50 dark:border-sky-400/80 dark:bg-sky-950/40"
                    : "border-zinc-200 bg-white hover:border-sky-300 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-sky-500/60"
                }`}
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  {summary.category.replace("_", " ")}
                </span>
                <span className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
                  {summary.count}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {statusFromCount(summary.count)}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Your examples
        </h2>
        {!selectedCategory && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Select a mistake type above to see real sentences from your writing.
          </p>
        )}
        {selectedCategory && mistakesInCategory.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No stored examples yet for this category.
          </p>
        )}
        {selectedCategory && mistakesInCategory.length > 0 && (
          <div className="grid gap-2 md:grid-cols-2">
            {mistakesInCategory.slice(0, 4).map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-zinc-200 bg-white p-3 text-xs text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              >
                <p className="mb-1 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  Your sentence
                </p>
                <p className="mb-1 text-[11px] text-zinc-700 dark:text-zinc-200">
                  “{m.sentence}”
                </p>
                <p className="mb-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-300">
                  Suggested
                </p>
                <p className="mb-1 text-[11px] text-emerald-700 dark:text-emerald-200">
                  “{m.correctedSentence}”
                </p>
                <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
                  {m.explanation}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">
          Practise this pattern
        </h2>
        {(!selectedCategory || !currentExercise) && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Pick a mistake type above to start practising. Exercises are built
            directly from your own sentences.
          </p>
        )}
        {selectedCategory && currentExercise && (
          <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {selectedCategory.replace("_", " ")}
              </span>
              <div className="flex gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setExerciseKind("fill_blank");
                    setFeedback(null);
                    setUserAnswer("");
                  }}
                  className={`rounded-full px-2 py-0.5 ${
                    exerciseKind === "fill_blank"
                      ? "bg-sky-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  Fill in the blank
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setExerciseKind("choose_correct");
                    setFeedback(null);
                    setUserAnswer("");
                  }}
                  className={`rounded-full px-2 py-0.5 ${
                    exerciseKind === "choose_correct"
                      ? "bg-sky-600 text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                  }`}
                >
                  Multiple choice
                </button>
              </div>
            </div>

            <p className="text-sm leading-relaxed text-zinc-800 dark:text-zinc-100">
              {currentExercise.prompt}
            </p>

            {exerciseKind === "fill_blank" && (
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-800 outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
                placeholder="Type the missing word or phrase"
              />
            )}

            {exerciseKind === "choose_correct" && currentExercise.options && (
              <div className="flex flex-wrap gap-2">
                {currentExercise.options.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setUserAnswer(opt)}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      userAnswer === opt
                        ? "border-sky-600 bg-sky-600 text-white"
                        : "border-zinc-300 bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={handleCheck}
                className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
                disabled={!userAnswer.trim()}
              >
                Check answer
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                Next example
              </button>
            </div>

            {feedback && (
              <div className="mt-2 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <p>{feedback}</p>
                <p className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  {currentExercise.explanation}
                </p>
              </div>
            )}
          </div>
        )}
      </section>
    </main>
  );
}

