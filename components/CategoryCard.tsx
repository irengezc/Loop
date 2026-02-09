"use client";

import { useState } from "react";
import { CanvasTextarea } from "@/components/CanvasTextarea";

type Task = { id: string; label: string; linkWord?: string };

type CategoryCardProps = {
  title: string;
  tasks: Task[];
  completedCount: number;
};

export function CategoryCard({
  title,
  tasks,
  completedCount,
}: CategoryCardProps) {
  const [activeTab, setActiveTab] = useState<"tasks" | "notes">("tasks");

  return (
    <div className="flex flex-col rounded-xl bg-white shadow-sm ring-1 ring-zinc-200/80 dark:bg-zinc-800 dark:ring-zinc-700/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-700/80">
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-100">
          {title}
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full ring-1 ring-zinc-200 dark:ring-zinc-600">
            <button
              type="button"
              onClick={() => setActiveTab("tasks")}
              className={`rounded-l-full px-3.5 py-1.5 text-sm ${
                activeTab === "tasks"
                  ? "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600"
                  : "text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              tasks
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("notes")}
              className={`rounded-r-full px-3.5 py-1.5 text-sm ${
                activeTab === "notes"
                  ? "bg-zinc-100 text-zinc-800 ring-1 ring-zinc-200 dark:bg-zinc-700 dark:text-zinc-100 dark:ring-zinc-600"
                  : "text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              }`}
            >
              notes
            </button>
          </div>
          <button
            type="button"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-700 dark:hover:text-zinc-300"
            aria-label="More options"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="opacity-80"
            >
              <circle cx="8" cy="3" r="1.25" />
              <circle cx="8" cy="8" r="1.25" />
              <circle cx="8" cy="13" r="1.25" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-5 py-4">
        {activeTab === "tasks" ? (
          <ul className="space-y-2.5">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 rounded border border-zinc-300 bg-white dark:border-zinc-500 dark:bg-zinc-700" />
                <span className="text-sm leading-snug text-zinc-700 dark:text-zinc-300">
                  {task.linkWord ? (
                    <>
                      {task.label.split(task.linkWord)[0]}
                      <a
                        href="#"
                        className="underline decoration-zinc-400 underline-offset-2 hover:decoration-zinc-600 dark:decoration-zinc-500 dark:hover:decoration-zinc-400"
                      >
                        {task.linkWord}
                      </a>
                      {task.label.split(task.linkWord)[1]}
                    </>
                  ) : (
                    task.label
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="min-h-[200px]">
            <CanvasTextarea
              placeholder=""
              defaultValue=""
              className="min-h-[200px] text-base"
              aria-label={`${title} notes`}
            />
          </div>
        )}
      </div>

      {/* Footer */}
      {activeTab === "tasks" && (
        <div className="border-t border-zinc-100 px-5 py-3 dark:border-zinc-700/80">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {completedCount} completed items
          </p>
        </div>
      )}
    </div>
  );
}
