import { MATCH_STATE_LABEL, type EntryMatchState } from "@/lib/entries/entries-query";
import { cn } from "@/lib/utils";

const STYLES: Record<EntryMatchState, string> = {
  matched: "border-emerald-600/30 bg-emerald-50 text-emerald-800",
  awaiting: "border-amber-600/30 bg-amber-50 text-amber-900",
  cash: "border-slate-400/40 bg-slate-50 text-slate-700",
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
