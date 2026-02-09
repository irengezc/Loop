import Link from "next/link";
import { CanvasTextarea } from "@/components/CanvasTextarea";
import { primaryButtonClass } from "@/components/PrimaryButton";

export default function RewritePage() {
  return (
    <main className="flex flex-1 flex-col gap-10">
      <div className="flex-1">
        <CanvasTextarea
          placeholder=""
          defaultValue=""
          aria-label="Rewrite canvas"
        />
      </div>
      <Link href="/practice" className={primaryButtonClass}>
        Continue to practice
      </Link>
    </main>
  );
}
