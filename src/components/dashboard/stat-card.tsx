import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn, formatMYR } from "@/lib/utils";

interface StatCardProps {
  title: string;
  /** Amount in RM; null shows `emptyText` instead. */
  value: number | null;
  icon: LucideIcon;
  hint?: string;
  emptyText?: string;
  tone?: "default" | "positive" | "negative";
  /** Highlighted card (teal tint), used for "Safe to spend". */
  featured?: boolean;
}

export function StatCard({
  title,
  value,
  icon: Icon,
  hint,
  emptyText = "—",
  tone = "default",
  featured = false,
}: StatCardProps) {
  return (
    <Card className={cn("hover:-translate-y-0.5", featured && "border-primary/70 bg-primary/10")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle as="p" className={cn("text-sm font-medium text-muted-foreground", featured && "text-primary")}>
          {title}
        </CardTitle>
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-muted-foreground",
            featured && "bg-primary/20 text-primary",
          )}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </CardHeader>
      <CardContent>
        {value === null ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <p
            className={cn(
              "text-2xl font-bold tabular-nums tracking-tight",
              tone === "positive" && !featured && "text-emerald-700 dark:text-emerald-300",
              tone === "negative" && "text-destructive",
            )}
          >
            {formatMYR(value)}
          </p>
        )}
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
