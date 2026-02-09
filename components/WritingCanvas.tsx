"use client";

import { useState, useEffect, useRef } from "react";

type BlockState = {
  status: "running" | "done";
  suggestion: string;
};

function getBlocks(content: string): { text: string; isComplete: boolean }[] {
  if (!content.trim()) return [];
  const raw = content.split(/(?<=\.)\s+/);
  return raw.map((t) => ({
    text: t.trim(),
    isComplete: t.trim().endsWith("."),
  }));
}

function mockProofread(text: string): string {
  return text;
}

export function WritingCanvas() {
  const [content, setContent] = useState("");
  const [blockStates, setBlockStates] = useState<Record<number, BlockState>>({});
  const blocks = getBlocks(content);
  const completeBlocks = blocks.filter((b) => b.isComplete);
  const allProofreadDone =
    completeBlocks.length > 0 &&
    completeBlocks.every((_, i) => blockStates[i]?.status === "done");
  const startedRef = useRef<Set<number>>(new Set());
  const prevLengthRef = useRef(0);

  useEffect(() => {
    if (completeBlocks.length < prevLengthRef.current) {
      startedRef.current.clear();
      setBlockStates({});
    }
    prevLengthRef.current = completeBlocks.length;

    const timeouts: ReturnType<typeof setTimeout>[] = [];
    completeBlocks.forEach((block, index) => {
      if (startedRef.current.has(index)) return;
      startedRef.current.add(index);
      setBlockStates((prev) => ({
        ...prev,
        [index]: { status: "running", suggestion: "" },
      }));
      const t = setTimeout(() => {
        setBlockStates((prev) => ({
          ...prev,
          [index]: {
            status: "done",
            suggestion: mockProofread(block.text),
          },
        }));
      }, 800 + index * 200);
      timeouts.push(t);
    });
    return () => timeouts.forEach(clearTimeout);
  }, [completeBlocks.length]);

  return (
    <div className="flex flex-col gap-10">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder=""
        rows={6}
        className="min-h-[50vh] w-full resize-none border-0 bg-transparent p-0 text-xl leading-loose text-zinc-800 outline-none placeholder:text-zinc-400/50 dark:text-zinc-200 dark:placeholder:text-zinc-500/50"
        aria-label="Writing canvas"
      />

      {completeBlocks.length > 0 && (
        <div className="border-t border-zinc-200/80 pt-8 dark:border-zinc-700/80">
          {!allProofreadDone ? (
            <div className="space-y-6">
              {completeBlocks.map((block, i) => (
                <div
                  key={i}
                  className="flex gap-6 items-start"
                >
                  <p className="flex-1 text-lg leading-relaxed text-zinc-800 dark:text-zinc-200">
                    {block.text}
                  </p>
                  <div className="w-full max-w-md shrink-0 rounded-lg border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-600 dark:bg-zinc-800/50">
                    {blockStates[i]?.status === "running" ? (
                      <p className="text-sm italic text-zinc-500 dark:text-zinc-400">
                        Proofreading…
                      </p>
                    ) : blockStates[i]?.status === "done" ? (
                      <p className="text-sm text-zinc-700 dark:text-zinc-300">
                        {blockStates[i].suggestion}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-8 sm:grid-cols-2">
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Your writing
                </p>
                <div className="space-y-4">
                  {completeBlocks.map((block, i) => (
                    <p
                      key={i}
                      className="text-lg leading-relaxed text-zinc-800 dark:text-zinc-200"
                    >
                      {block.text}
                    </p>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Proofread
                </p>
                <div className="space-y-4">
                  {completeBlocks.map((_, i) => (
                    <p
                      key={i}
                      className="text-lg leading-relaxed text-zinc-700 dark:text-zinc-300"
                    >
                      {blockStates[i]?.suggestion ?? ""}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
