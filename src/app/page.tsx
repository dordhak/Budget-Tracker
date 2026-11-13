import { CircleDollarSign, Plus, Scale, TrendingDown, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryDonut } from "@/components/charts/category-donut";
import { DailyLine } from "@/components/charts/daily-line";
import { MonthlyBars } from "@/components/charts/monthly-bars";
import { BudgetBar } from "@/components/dashboard/budget-bar";
import { CategoryBudgetForm } from "@/components/dashboard/category-budget-form";
import { CategoryBudgetList, type BudgetRow } from "@/components/dashboard/category-budget-list";
import { OverallLimitForm } from "@/components/dashboard/overall-limit-form";
import { StatCard } from "@/components/dashboard/stat-card";
import { MatchBadge } from "@/components/entries/match-badge";
import { MonthPicker } from "@/components/month-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sumLimits } from "@/lib/budget";
import {
  budgetItems,
  categoryBreakdown,
  dailySeries,
  entryStatus,
  monthlySeries,
  monthTotals,
} from "@/lib/dashboard/aggregate";
import { loadWindow, resolveMonth } from "@/lib/dashboard/load";
import { entryMatchState } from "@/lib/entries/entries-query";
import { todayIso } from "@/lib/entries/validate-entry";
import { monthLabel } from "@/lib/month";
import { summarizeSpending } from "@/lib/spending";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMYR } from "@/lib/utils";

export const metadata: Metadata = { title: "Budget · Budget Tracker" };

const dayFmt = new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function BudgetDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { month, current } = resolveMonth((await searchParams).month);
  const supabase = await createClient();

  const [data, budgetsRes, settingsRes, rulesRes] = await Promise.all([
    loadWindow(supabase, month),
    supabase.from("budgets").select("id, category, monthly_limit").order("category"),
    supabase.from("settings").select("overall_monthly_limit").maybeSingle(),
    supabase.from("category_rules").select("category"),
  ]);
  if (budgetsRes.error || settingsRes.error) {
    console.error("Budget query failed", budgetsRes.error ?? settingsRes.error);
    throw new Error("Could not load your budgets.");
  }

  // Each purchase once: your entries + statement rows you didn't log.
  const items = budgetItems(data.entries, data.transactions, data.linkedTxIds);
  const totals = monthTotals(items, month);
  const slices = categoryBreakdown(items, month);
  const spentByCategory = new Map(categoryBreakdown(items, month, Number.POSITIVE_INFINITY).map((s) => [s.category, s.cents]));
  const series = monthlySeries(items, data.months);
  const days = dailySeries(items, month, month === current ? todayIso() : undefined);
  const status = entryStatus(data.entries, month, data.coveredUntil);
  const unlogged = data.transactions.filter((t) => t.date.startsWith(month) && !data.linkedTxIds.has(t.id)).length;

  const spending = summarizeSpending(days.map((d) => ({ day: d.day, total: d.cents / 100 })));
  const dailySummary =
    spending.total === 0
      ? `No spending recorded in ${monthLabel(month)}.`
      : `Spent ${formatMYR(spending.total)} in ${monthLabel(month)}, about ${formatMYR(spending.average)} a day.` +
        (spending.peak ? ` Highest day: ${spending.peak.label}, ${formatMYR(spending.peak.total)}.` : "");

  const budgets: BudgetRow[] = (budgetsRes.data ?? []).map((b) => ({
    id: b.id as string,
    category: b.category as string,
    monthly_limit: Number(b.monthly_limit),
  }));
  const categoryLimitTotal = sumLimits(budgets);
  const rawOverall = settingsRes.data?.overall_monthly_limit;
  const overallLimit = rawOverall == null ? null : Number(rawOverall);
  const spent = totals.expenseCents / 100;
  const safeToSpend = overallLimit === null ? null : overallLimit - spent;

  const budgeted = new Set(budgets.map((b) => b.category));
  const suggestions = [...new Set([...(rulesRes.data ?? []).map((r) => r.category as string), ...spentByCategory.keys()])]
    .filter((c) => !budgeted.has(c))
    .sort();

  const recent = data.entries.filter((e) => e.date.startsWith(month)).slice(0, 6);

  return (
    <div className="stagger space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budget</h1>
          <p className="text-sm text-muted-foreground">
            {monthLabel(month)}: your entries plus statement rows you didn&apos;t log, each counted once.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <MonthPicker basePath="/" month={month} current={current} />
          <Button asChild>
            <Link href="/entries/new">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add entry
            </Link>
          </Button>
        </div>
      </div>

      <section aria-label="Month totals" data-inner className="stagger-inner grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Income" value={totals.incomeCents / 100} icon={TrendingUp} tone="positive" hint="Salary and other income" />
        <StatCard title="Expenses" value={spent} icon={TrendingDown} hint="Entries plus unlogged statement rows" />
        <StatCard
          title="Balance"
          value={totals.netCents / 100}
          icon={Scale}
          tone={totals.netCents < 0 ? "negative" : "default"}
          hint="Income minus expenses"
        />
        <StatCard
          title={month === current ? "Safe to spend" : "Left of limit"}
          value={safeToSpend}
          icon={CircleDollarSign}
          tone={safeToSpend !== null && safeToSpend < 0 ? "negative" : "positive"}
          featured={safeToSpend === null || safeToSpend >= 0}
          emptyText="Set an overall limit below"
          hint={overallLimit !== null ? `Overall limit ${formatMYR(overallLimit)}` : undefined}
        />
      </section>

      {(status.awaiting > 0 || status.notOnStatement > 0 || unlogged > 0) && (
        <ul className="flex flex-wrap gap-2 text-sm" aria-label="Matching status">
          {status.awaiting > 0 && (
            <li>
              <Link
                href={`/entries?month=${month}&status=awaiting`}
                className="inline-flex rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-amber-900 dark:text-amber-200 hover:bg-amber-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {status.awaiting} {status.awaiting === 1 ? "entry" : "entries"} awaiting statement
              </Link>
            </li>
          )}
          {status.notOnStatement > 0 && (
            <li>
              <Link
                href={`/entries?month=${month}&status=awaiting`}
                className="inline-flex rounded-full border border-destructive/30 bg-red-400/10 px-3 py-1 text-red-800 dark:text-red-300 hover:bg-red-400/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {status.notOnStatement} not on statement
              </Link>
            </li>
          )}
          {unlogged > 0 && (
            <li>
              <Link
                href="/statements"
                className="inline-flex rounded-full border px-3 py-1 text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {unlogged} statement {unlogged === 1 ? "row" : "rows"} you didn&apos;t log (included)
              </Link>
            </li>
          )}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Spending by category</CardTitle>
            <CardDescription>{monthLabel(month)}</CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryDonut slices={slices} totalCents={totals.expenseCents} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Income vs expenses</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <MonthlyBars points={series} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Daily spending</CardTitle>
          <CardDescription>{dailySummary}</CardDescription>
        </CardHeader>
        <CardContent>
          {spending.total === 0 ? (
            <p className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              Nothing spent yet this month.
            </p>
          ) : (
            <DailyLine points={days} summary={dailySummary} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget for {monthLabel(month)}</CardTitle>
          <CardDescription>Spent so far: {formatMYR(spent)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <BudgetBar
            id="bar-overall"
            label="Against overall monthly limit"
            spent={spent}
            limit={overallLimit}
            emptyText="Set an overall monthly limit below to track it here."
          />
          <BudgetBar
            id="bar-categories"
            label="Against the sum of category limits"
            spent={spent}
            limit={categoryLimitTotal}
            emptyText="Add category limits below to track spending against their total."
          />
          {budgets.length > 0 && (
            <div className="space-y-4 border-t pt-4">
              <h3 className="text-sm font-medium">Per category</h3>
              {budgets.map((b) => (
                <BudgetBar
                  key={b.id}
                  id={`bar-cat-${b.id}`}
                  label={b.category}
                  spent={(spentByCategory.get(b.category) ?? 0) / 100}
                  limit={b.monthly_limit}
                  emptyText="No limit"
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Overall limit</CardTitle>
          </CardHeader>
          <CardContent>
            <OverallLimitForm current={overallLimit} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Category limits</CardTitle>
            <CardDescription>
              Total: {formatMYR(categoryLimitTotal)}. Saving an existing name updates its limit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryBudgetList budgets={budgets} />
            <CategoryBudgetForm suggestions={suggestions} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent entries</CardTitle>
          <Link href={`/entries?month=${month}`} className="text-sm text-primary underline-offset-4 hover:underline">
            View all
          </Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entries in {monthLabel(month)}.{" "}
              <Link href="/entries/new" className="underline underline-offset-4">
                Add one
              </Link>
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <Link href={`/entries/${e.id}`} className="min-w-0 flex-1 truncate font-medium underline-offset-4 hover:text-primary hover:underline">
                    {e.merchant || e.category}
                  </Link>
                  <span className="text-muted-foreground">{dayFmt.format(new Date(`${e.date}T00:00:00Z`))}</span>
                  <MatchBadge state={entryMatchState(e)} />
                  <span className={cn("w-28 text-right tabular-nums", e.type === "income" && "text-emerald-700 dark:text-emerald-300")}>
                    {e.type === "income" ? "+" : "−"}
                    {formatMYR(Number(e.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
