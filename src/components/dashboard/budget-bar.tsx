import { Progress } from "@/components/ui/progress";
import { budgetProgress } from "@/lib/budget";
import { cn, formatMYR } from "@/lib/utils";

interface BudgetBarProps {
  id: string;
  label: string;
  spent: number;
  limit: number | null;
  emptyText: string;
}

const INDICATOR = {
  unset: "bg-muted-foreground",
  ok: "bg-emerald-600",
  warning: "bg-amber-500",
  over: "bg-destructive",
} as const;

/** Server Component: progress maths happens here; only the bar itself is a client primitive. */
export function BudgetBar({ id, label, spent, limit, emptyText }: BudgetBarProps) {
  const p = budgetProgress(spent, limit);

  if (p.status === "unset") {
    return (
      <div className="space-y-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      </div>
    );
  }

  const summary =
    p.status === "over"
      ? `${formatMYR(Math.abs(p.remaining ?? 0))} over budget`
      : `${formatMYR(p.remaining ?? 0)} left`;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p id={`${id}-label`} className="text-sm font-medium">
          {label}
        </p>
        <p className="text-sm tabular-nums text-muted-foreground">
          {formatMYR(spent)} of {formatMYR(limit ?? 0)} ({p.rawPercent}%)
        </p>
      </div>
      <Progress
        value={p.percent}
        aria-labelledby={`${id}-label`}
        aria-valuetext={`${p.rawPercent}% used, ${summary}`}
        indicatorClassName={INDICATOR[p.status]}
      />
      <p
        className={cn(
          "text-xs",
          p.status === "over" ? "font-medium text-destructive" : "text-muted-foreground",
          p.status === "warning" && "text-amber-700",
        )}
      >
        {summary}
      </p>
    </div>
  );
}
