import { Link2, Scale, TrendingDown, TrendingUp, Upload } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryDonut } from "@/components/charts/category-donut";
import { DailyLine } from "@/components/charts/daily-line";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { StatCard } from "@/components/dashboard/stat-card";
import { MonthPicker } from "@/components/month-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { categoryBreakdown, dailySeries, monthlySeries, monthTotals, statementItems } from "@/lib/dashboard/aggregate";
import { periodBalance } from "@/lib/dashboard/balances";
import { loadWindow, resolveMonth } from "@/lib/dashboard/load";
import { todayIso } from "@/lib/entries/validate-entry";
import { monthLabel } from "@/lib/month";
import { summarizeSpending } from "@/lib/spending";
import { createClient } from "@/lib/supabase/server";
import { formatMYR } from "@/lib/utils";

export const metadata: Metadata = { title: "Statements · Budget Tracker" };

/** Statement dashboard: bank facts only, from imported statements. */
export default async function StatementDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { month, current } = resolveMonth((await searchParams).month);
  const supabase = await createClient();
  const [data, accountsRes] = await Promise.all([
    loadWindow(supabase, month),
    supabase.from("accounts").select("id, name").order("name"),
  ]);

  const items = statementItems(data.transactions);
  const totals = monthTotals(items, month);
  const slices = categoryBreakdown(items, month);
  const series = monthlySeries(items, data.months);
  const days = dailySeries(items, month, month === current ? todayIso() : undefined);

  const monthRows = data.transactions.filter((t) => t.date.startsWith(month));
  const matched = monthRows.filter((t) => data.linkedTxIds.has(t.id)).length;

  const accountNames = new Map((accountsRes.data ?? []).map((a) => [a.id as string, a.name as string]));
  const byAccount = new Map<string, typeof monthRows>();
  for (const t of monthRows) {
    const key = t.account_id ?? "none";
    byAccount.set(key, [...(byAccount.get(key) ?? []), t]);
  }
  const balances = [...byAccount]
    .map(([accountId, rows]) => ({
      accountId,
      name: accountNames.get(accountId) ?? "Unassigned",
      rows: rows.length,
      balance: periodBalance(rows),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const spending = summarizeSpending(days.map((d) => ({ day: d.day, total: d.cents / 100 })));
  const dailySummary =
    spending.total === 0
      ? `No statement spending in ${monthLabel(month)}.`
      : `${formatMYR(spending.total)} left your accounts in ${monthLabel(month)}, about ${formatMYR(spending.average)} a day.` +
        (spending.peak ? ` Highest day: ${spending.peak.label}, ${formatMYR(spending.peak.total)}.` : "");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statements</h1>
          <p className="text-sm text-muted-foreground">
            {monthLabel(month)}, exactly as your bank reported it.
            {data.coveredUntil && ` Imported up to ${data.coveredUntil}.`}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <MonthPicker basePath="/statements" month={month} current={current} />
          <Button asChild variant="outline">
            <Link href="/import">
              <Upload className="h-4 w-4" aria-hidden="true" />
              Import statement
            </Link>
          </Button>
        </div>
      </div>

      {monthRows.length === 0 ? (
        <Card>
          <CardContent className="space-y-2 p-10 text-center">
            <p className="font-medium">No statement rows for {monthLabel(month)}.</p>
            <p className="text-sm text-muted-foreground">
              Maybank statements arrive after the month ends.{" "}
              <Link href="/import" className="underline underline-offset-4">
                Import one
              </Link>{" "}
              or pick another month.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label="Month totals" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Money in" value={totals.incomeCents / 100} icon={TrendingUp} tone="positive" />
            <StatCard title="Money out" value={totals.expenseCents / 100} icon={TrendingDown} />
            <StatCard
              title="Net change"
              value={totals.netCents / 100}
              icon={Scale}
              tone={totals.netCents < 0 ? "negative" : "positive"}
            />
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle as="p" className="text-sm font-medium text-muted-foreground">
                  Matched to entries
                </CardTitle>
                <Link2 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold tabular-nums">
                  {matched} <span className="text-base font-normal text-muted-foreground">of {monthRows.length}</span>
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {monthRows.length - matched} row{monthRows.length - matched === 1 ? "" : "s"} you didn&apos;t log
                </p>
              </CardContent>
            </Card>
          </section>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Account balances</CardTitle>
              <CardDescription>Opening and closing balance for {monthLabel(month)}, from the running balance.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Rows</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balances.map((b) => (
                    <TableRow key={b.accountId}>
                      <TableCell className="font-medium">{b.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.rows}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.balance ? formatMYR(b.balance.openingCents / 100) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {b.balance ? formatMYR(b.balance.closingCents / 100) : "—"}
                        {b.balance && !b.balance.exact && (
                          <span className="block text-xs font-normal text-amber-800">approximate (rows missing)</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Money out by category</CardTitle>
                <CardDescription>Statement categories (from your keyword rules)</CardDescription>
              </CardHeader>
              <CardContent>
                <CategoryDonut slices={slices} totalCents={totals.expenseCents} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Money in vs out</CardTitle>
                <CardDescription>Last 6 months</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyBars points={series} />
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Daily money out</CardTitle>
              <CardDescription>{dailySummary}</CardDescription>
            </CardHeader>
            <CardContent>
              <DailyLine points={days} summary={dailySummary} />
            </CardContent>
          </Card>

          <p className="text-sm text-muted-foreground">
            See every row on the{" "}
            <Link href="/expenses" className="underline underline-offset-4">
              Expenses
            </Link>{" "}
            page.
          </p>
        </>
      )}
    </div>
  );
}
