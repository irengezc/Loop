import Link from "next/link";
import { primaryButtonClass } from "@/components/PrimaryButton";

export default function FeedbackPage() {
  return (
    <main className="flex flex-1 flex-col gap-8">
      <h1 className="text-2xl font-semibold">Feedback</h1>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-800/50">
        <p className="text-zinc-700 dark:text-zinc-300">
          Placeholder feedback: Your writing shows good structure. Consider
          adding more specific examples in the second paragraph.
        </p>
      </div>
      <Link href="/rewrite" className={primaryButtonClass}>
        Continue to rewrite
      </Link>
    </main>
  );
}
