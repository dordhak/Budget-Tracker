"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { formatMYR } from "@/lib/utils";
import { linkEntry, unlinkEntry } from "./actions";

export interface StatementRow {
  id: string;
  date: string;
  amount: number;
  description: string;
  merchant: string | null;
  exact: boolean;
}

const fmt = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const day = (iso: string) => fmt.format(new Date(`${iso}T00:00:00Z`));

export function LinkPanel({
  entryId,
  paymentMethod,
  linked,
  candidates,
}: {
  entryId: string;
  paymentMethod: "bank" | "cash";
  linked: StatementRow | null;
  candidates: StatementRow[];
}) {
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  };

  if (paymentMethod === "cash") {
    return <p className="text-sm text-muted-foreground">Cash entries don&apos;t appear on bank statements.</p>;
  }

  return (
    <div className="space-y-3 text-sm">
      {linked ? (
        <div className="space-y-2 rounded-md border border-emerald-400/30 bg-emerald-400/10 p-3">
          <p className="font-medium text-emerald-700 dark:text-emerald-300">Matched to a statement row</p>
          <p>
            <Link href={`/expenses/${linked.id}`} className="underline underline-offset-4">
              {linked.merchant || linked.description}
            </Link>{" "}
            · {day(linked.date)} · {formatMYR(linked.amount)}
          </p>
          <Button type="button" variant="outline" size="sm" disabled={isPending} onClick={() => run(() => unlinkEntry(entryId))}>
            Unlink
          </Button>
        </div>
      ) : candidates.length === 0 ? (
        <p className="text-muted-foreground">
          Not on an imported statement yet. When you import the statement for this period, it&apos;s matched
          automatically if a row has the same amount within 3 days.
        </p>
      ) : (
        <div className="space-y-2">
          <p>Statement rows that could be this entry (same type, within 7 days):</p>
          <ul className="divide-y rounded-md border">
            {candidates.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="font-medium">{c.merchant || c.description}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {day(c.date)} · {formatMYR(c.amount)}
                  </span>
                  {c.exact && <span className="ml-2 text-xs text-emerald-700 dark:text-emerald-300">Same amount</span>}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={c.exact ? "default" : "outline"}
                  disabled={isPending}
                  onClick={() => run(() => linkEntry(entryId, c.id))}
                  aria-label={`Link to ${c.merchant || c.description} on ${day(c.date)}, ${formatMYR(c.amount)}`}
                >
                  Link
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
