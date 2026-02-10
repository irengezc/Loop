import { WritingCanvas } from "@/components/WritingCanvas";
import { ModeTabs } from "@/components/ModeTabs";

export default function Home() {
  return (
    <main className="mx-auto max-w-2xl bg-white px-6 py-16 dark:bg-zinc-900 sm:px-8 sm:py-24">
      <ModeTabs />
      <WritingCanvas />
    </main>
  );
}
