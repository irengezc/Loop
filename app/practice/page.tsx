import Link from "next/link";
import { primaryButtonClass } from "@/components/PrimaryButton";

export default function PracticePage() {
  return (
    <main className="flex flex-1 flex-col gap-8">
      <h1 className="text-2xl font-semibold">Practice</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        Practice prompt or exercise. (Placeholder)
      </p>
      <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-700">
        <p className="text-zinc-700 dark:text-zinc-300">
          Try writing one more sentence using the feedback you received.
        </p>
      </div>
      <Link href="/done" className={primaryButtonClass}>
        Finish
      </Link>
    </main>
  );
}
