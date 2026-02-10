import { WritingCanvas } from "@/components/WritingCanvas";

export default function WritePage() {
  return (
    <main className="mx-auto max-w-2xl bg-white px-6 py-16 dark:bg-zinc-900 sm:px-8 sm:py-24">
      <WritingCanvas />
    </main>
  );
}