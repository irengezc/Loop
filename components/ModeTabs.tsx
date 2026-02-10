"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function ModeTabs() {
  const pathname = usePathname();
  const isWriting = pathname === "/" || pathname.startsWith("/write");
  const isPractice = pathname.startsWith("/practice");

  return (
    <div className="mb-6 inline-flex rounded-full border border-zinc-200 bg-zinc-100 p-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
      <Link
        href="/"
        className={`rounded-full px-3 py-1 transition ${
          isWriting
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
            : "hover:text-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        Writing
      </Link>
      <Link
        href="/practice"
        className={`rounded-full px-3 py-1 transition ${
          isPractice
            ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
            : "hover:text-zinc-900 dark:hover:text-zinc-100"
        }`}
      >
        Practice
      </Link>
    </div>
  );
}

