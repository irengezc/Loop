import Link from "next/link";
import { primaryButtonClass } from "@/components/PrimaryButton";

export default function DonePage() {
  return (
    <main className="flex flex-1 flex-col gap-8">
      <h1 className="text-2xl font-semibold">Done</h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        You’ve completed this round. (Placeholder)
      </p>
      <Link href="/write" className={primaryButtonClass}>
        Start again
      </Link>
    </main>
  );
}
