import { MATCH_STATE_LABEL, type EntryMatchState } from "@/lib/entries/entries-query";
import { cn } from "@/lib/utils";

const STYLES: Record<EntryMatchState, string> = {
  matched: "border-emerald-400/30 bg-emerald-400/10 text-emerald-700 dark:text-emerald-300",
  awaiting: "border-amber-400/30 bg-amber-400/10 text-amber-800 dark:text-amber-300",
  cash: "border-slate-400/30 bg-slate-400/10 text-slate-700 dark:text-slate-300",
};

export function MatchBadge({ state, className }: { state: EntryMatchState; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        STYLES[state],
        className,
      )}
    >
      {MATCH_STATE_LABEL[state]}
    </span>
  );
}
