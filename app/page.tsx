import { CategoryCard } from "@/components/CategoryCard";

const WORK_TASKS = [
  { id: "1", label: "Address comments in figma", linkWord: "figma" },
  {
    id: "2",
    label:
      "Finish reflections and peer-reviews in workday - see drafts in google doc here (30min-ish)",
  },
  {
    id: "3",
    label:
      "Explore spotlight and stats+logo carousel components (solutions page templates)",
  },
  {
    id: "4",
    label:
      "Schedule 1:1 with Tobi to talk about wallpaper studio prototype and potential 3D shader library",
  },
  { id: "5", label: "Content wireframe review prep" },
  { id: "6", label: "{web motion doc} add easing preset values" },
  {
    id: "7",
    label: "--base-color matching for label (AA minimum) and Gradients (??)",
  },
];

const LIFE_TASKS = [
  { id: "1", label: "Reply to Charles email" },
  { id: "2", label: "Solar panel appt (06.17 - 9am)" },
  { id: "3", label: "Close coinbase account" },
  { id: "4", label: "Order sardines" },
  { id: "5", label: "Install blinds" },
  {
    id: "6",
    label:
      "Post idea: The vanilla web. The continuation of mobile native UI, one col, Context agnostic Unified responsive behavior... web design in the AI/spatial computing era",
  },
];

export default function Home() {
  return (
    <div className="flex flex-col gap-12">
      <header className="pl-1">
        <p className="text-xl font-semibold text-zinc-800 dark:text-zinc-100">
          Howdy Nicolas,
        </p>
        <p className="mt-0.5 text-zinc-600 dark:text-zinc-400">
          You have 13 ongoing tasks
        </p>
      </header>

      <div className="grid gap-8 sm:grid-cols-2">
        <CategoryCard
          title="Work"
          tasks={WORK_TASKS}
          completedCount={35}
        />
        <CategoryCard
          title="Life"
          tasks={LIFE_TASKS}
          completedCount={600}
        />
      </div>
    </div>
  );
}
