import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  PAGE_SIZE,
  expensesHref,
  pageCount,
  pageRange,
  parseExpenseParams,
  visiblePages,
  type ExpenseParams,
} from "@/lib/expenses-query";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMYR } from "@/lib/utils";
import { ExpenseFilters } from "./expense-filters";

export const metadata: Metadata = { title: "Expenses · Budget Tracker" };

const dateFmt = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const formatDay = (iso: string) => dateFmt.format(new Date(`${iso}T00:00:00Z`));

interface ExpenseRow {
  id: string;
  date: string;
  amount: number | string;
  category: string;
  description: string;
  merchant: string | null;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = parseExpenseParams(await searchParams);
  const supabase = await createClient();
  const [from, to] = pageRange(params.page);

  let query = supabase
    .from("transactions")
    .select("id, date, amount, category, description, merchant", { count: "exact" })
    .eq("type", "expense");
  if (params.category) query = query.eq("category", params.category);
  // Safe to interpolate: sanitizeSearch strips PostgREST syntax and LIKE wildcards.
  if (params.q) query = query.or(`description.ilike.%${params.q}%,merchant.ilike.%${params.q}%`);

  const [listRes, categoriesRes] = await Promise.all([
    query
      .order("date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to),
    // Distinct categories for the filter (fine at personal-budget scale).
    supabase.from("transactions").select("category").eq("type", "expense").limit(10_000),
  ]);

  if (listRes.error || categoriesRes.error) {
    console.error("Expenses query failed", listRes.error ?? categoriesRes.error);
    throw new Error("Could not load your expenses.");
  }

  const total = listRes.count ?? 0;
  const pages = pageCount(total);
  // Out-of-range page (e.g. after filtering): go to the last real page.
  if (total > 0 && params.page > pages) redirect(expensesHref(params, { page: pages }));

  const rows = (listRes.data ?? []) as ExpenseRow[];
  const categories = [...new Set((categoriesRes.data ?? []).map((r) => r.category as string))].sort((a, b) =>
    a.localeCompare(b),
  );
  if (params.category && !categories.includes(params.category)) categories.push(params.category);

  const filtered = Boolean(params.q || params.category);
  const firstShown = total === 0 ? 0 : from + 1;
  const lastShown = Math.min(to + 1, total);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        <p className="text-sm text-muted-foreground">All money going out, newest first.</p>
      </div>

      <ExpenseFilters params={params} categories={categories} />

      <Card>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="space-y-2 p-10 text-center">
              <p className="font-medium">{filtered ? "No expenses match your filters." : "No expenses yet."}</p>
              <p className="text-sm text-muted-foreground">
                {filtered ? (
                  <Link href="/expenses" className="underline underline-offset-4">
                    Clear filters
                  </Link>
                ) : (
                  <Link href="/import" className="underline underline-offset-4">
                    Import a statement
                  </Link>
                )}
              </p>
            </div>
          ) : (
            <Table>
              <TableCaption className="sr-only">
                Expenses {firstShown} to {lastShown} of {total}
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Date</TableHead>
                  <TableHead>Merchant</TableHead>
                  <TableHead className="hidden md:table-cell">Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="relative">
                    <TableCell className="whitespace-nowrap text-sm text-muted-foreground">{formatDay(row.date)}</TableCell>
                    <TableCell className="max-w-0 w-full">
                      {/* The link covers the whole row (after:inset-0) while staying one tab stop. */}
                      <Link
                        href={`/expenses/${row.id}`}
                        className="block truncate font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
                      >
                        {row.merchant || row.description || "Expense"}
                      </Link>
                      <span className="block truncate text-xs text-muted-foreground">
                        {row.description}
                        <span className="md:hidden"> · {row.category}</span>
                      </span>
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-sm md:table-cell">{row.category}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums">
                      {formatMYR(Number(row.amount))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {total > 0 && <Pagination params={params} pages={pages} summary={`${firstShown}–${lastShown} of ${total}`} />}
    </div>
  );
}

function Pagination({ params, pages, summary }: { params: ExpenseParams; pages: number; summary: string }) {
  const linkClass =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-3 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  const disabledClass = "pointer-events-none opacity-50";

  return (
    <nav aria-label="Pagination" className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-sm text-muted-foreground">
        Showing {summary} (page size {PAGE_SIZE})
      </p>
      <ul className="flex flex-wrap items-center gap-1">
        <li>
          <Link
            href={expensesHref(params, { page: params.page - 1 })}
            aria-disabled={params.page <= 1}
            tabIndex={params.page <= 1 ? -1 : undefined}
            className={cn(linkClass, params.page <= 1 && disabledClass)}
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
                href={expensesHref(params, { page: p })}
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
            href={expensesHref(params, { page: params.page + 1 })}
            aria-disabled={params.page >= pages}
            tabIndex={params.page >= pages ? -1 : undefined}
            className={cn(linkClass, params.page >= pages && disabledClass)}
          >
            Next
          </Link>
        </li>
      </ul>
    </nav>
  );
}
