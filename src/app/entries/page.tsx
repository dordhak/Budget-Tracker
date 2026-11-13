import { Paperclip, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MatchBadge } from "@/components/entries/match-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ENTRIES_PAGE_SIZE,
  entriesHref,
  entryMatchState,
  parseEntryParams,
  type EntryParams,
} from "@/lib/entries/entries-query";
import { pageCount, pageRange, visiblePages } from "@/lib/expenses-query";
import { monthBounds, monthLabel } from "@/lib/month";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMYR } from "@/lib/utils";
import { EntryFilters } from "./entry-filters";

export const metadata: Metadata = { title: "Entries · Budget Tracker" };

const dateFmt = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

interface EntryRow {
  id: string;
  date: string;
  amount: number | string;
  type: "income" | "expense";
  category: string;
  merchant: string | null;
  notes: string | null;
  payment_method: "bank" | "cash";
  receipt_path: string | null;
  transaction_id: string | null;
}

export default async function EntriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseEntryParams(await searchParams);
  const supabase = await createClient();
  const [from, to] = pageRange(params.page, ENTRIES_PAGE_SIZE);

  let query = supabase
    .from("entries")
    .select("id, date, amount, type, category, merchant, notes, payment_method, receipt_path, transaction_id", {
      count: "exact",
    });
  if (params.month) {
    const b = monthBounds(params.month);
    query = query.gte("date", b.from).lte("date", b.to);
  }
  if (params.type) query = query.eq("type", params.type);
  if (params.status === "cash") query = query.eq("payment_method", "cash");
  if (params.status === "awaiting") query = query.eq("payment_method", "bank").is("transaction_id", null);
  if (params.status === "matched") query = query.not("transaction_id", "is", null);
  // Safe to interpolate: sanitizeSearch strips PostgREST syntax and LIKE wildcards.
  if (params.q) query = query.or(`merchant.ilike.%${params.q}%,category.ilike.%${params.q}%,notes.ilike.%${params.q}%`);

  const { data, count, error } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("Entries query failed", error);
    throw new Error("Could not load your entries.");
  }

  const total = count ?? 0;
  const pages = pageCount(total, ENTRIES_PAGE_SIZE);
  if (total > 0 && params.page > pages) redirect(entriesHref(params, { page: pages }));

  const rows = (data ?? []) as EntryRow[];
  const filtered = Boolean(params.q || params.month || params.type || params.status);
  const firstShown = total === 0 ? 0 : from + 1;
  const lastShown = Math.min(to + 1, total);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Entries</h1>
          <p className="text-sm text-muted-foreground">
            Income and spending you recorded yourself{params.month ? ` in ${monthLabel(params.month)}` : ""}.
          </p>
        </div>
        <Button asChild>
          <Link href="/entries/new">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add entry
          </Link>
        </Button>
      </div>

      <EntryFilters params={params} />

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="space-y-2 p-10 text-center">
              <p className="font-medium">{filtered ? "No entries match your filters." : "No entries yet."}</p>
              <p className="text-sm text-muted-foreground">
                <Link href={filtered ? "/entries" : "/entries/new"} className="underline underline-offset-4">
                  {filtered ? "Clear filters" : "Add your first entry"}
                </Link>
              </p>
            </div>
          ) : (
            <Table>
              <TableCaption className="sr-only">
                Entries {firstShown} to {lastShown} of {total}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead className="hidden md:table-cell">Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const state = entryMatchState(row);
                  return (
                    <TableRow key={row.id} className="relative">
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {dateFmt.format(new Date(`${row.date}T00:00:00Z`))}
                      </TableCell>
                      <TableCell className="w-full max-w-0">
                        <Link
                          href={`/entries/${row.id}`}
                          className="flex items-center gap-1.5 font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                        >
                          <span className="truncate">{row.merchant || row.category}</span>
                          {row.receipt_path && (
                            <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Has receipt" />
                          )}
                        </Link>
                        <span className="block truncate text-xs text-muted-foreground">
                          {row.category}
                          {row.notes && ` · ${row.notes}`}
                        </span>
                        <MatchBadge state={state} className="mt-1 md:hidden" />
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <MatchBadge state={state} />
                      </TableCell>
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right tabular-nums",
                          row.type === "income" && "text-emerald-700 dark:text-emerald-300",
                        )}
                      >
                        {row.type === "income" ? "+" : "−"}
                        {formatMYR(Number(row.amount))}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > 0 && <Pagination params={params} pages={pages} summary={`${firstShown}–${lastShown} of ${total}`} />}
    </div>
  );
}

function Pagination({ params, pages, summary }: { params: EntryParams; pages: number; summary: string }) {
  const linkClass =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const disabled = "pointer-events-none opacity-50";
  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">Showing {summary}</p>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <Link
            href={entriesHref(params, { page: params.page - 1 })}
            aria-disabled={params.page <= 1}
            tabIndex={params.page <= 1 ? -1 : undefined}
            className={cn(linkClass, params.page <= 1 && disabled)}
          >
            Previous
          </Link>
        </li>
        {visiblePages(params.page, pages).map((p, i) =>
          p === "…" ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-2 text-muted-foreground">
              …
            </li>
          ) : (
            <li key={p}>
              <Link
                href={entriesHref(params, { page: p })}
                aria-current={p === params.page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cn(linkClass, p === params.page && "border-primary bg-primary text-primary-foreground hover:bg-primary")}
              >
                {p}
              </Link>
            </li>
          ),
        )}
        <li>
          <Link
            href={entriesHref(params, { page: params.page + 1 })}
            aria-disabled={params.page >= pages}
            tabIndex={params.page >= pages ? -1 : undefined}
            className={cn(linkClass, params.page >= pages && disabled)}
          >
            Next
          </Link>
        </li>
      </ul>
    </nav>
  );
}
