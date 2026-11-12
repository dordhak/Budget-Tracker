"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isMonth, monthLabel, shiftMonth } from "@/lib/month";
import { cn } from "@/lib/utils";

/** Previous / next links plus a native month input; state lives in `?month=YYYY-MM`. */
export function MonthPicker({ basePath, month, current }: { basePath: string; month: string; current: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const href = (m: string) => (m === current ? basePath : `${basePath}?month=${m}`);
  const next = shiftMonth(month, 1);
  const btn =
    "inline-flex h-10 w-10 items-center justify-center rounded-md border hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className={cn("flex items-end gap-2", isPending && "opacity-70")}>
      <Link href={href(shiftMonth(month, -1))} className={btn} aria-label={`Previous month, ${monthLabel(shiftMonth(month, -1))}`}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Link>
      <div className="space-y-1">
        <Label htmlFor="month-picker" className="sr-only">
          Month
        </Label>
        <Input
          id="month-picker"
          type="month"
          className="w-44"
          value={month}
          max={current}
          onChange={(e) => {
            const m = e.target.value;
            if (isMonth(m) && m <= current) startTransition(() => router.push(href(m)));
          }}
        />
      </div>
      {next <= current ? (
        <Link href={href(next)} className={btn} aria-label={`Next month, ${monthLabel(next)}`}>
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      ) : (
        <span className={cn(btn, "pointer-events-none opacity-40")} aria-hidden="true">
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
      {month !== current && (
        <Link href={basePath} className="ml-1 self-center text-sm underline underline-offset-4">
          This month
        </Link>
      )}
    </div>
  );
}
