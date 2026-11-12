import { Scale, TrendingDown, TrendingUp } from "lucide-react";
import { BudgetBar } from "@/components/dashboard/budget-bar";
import { CategoryBudgetForm } from "@/components/dashboard/category-budget-form";
import { CategoryBudgetList, type BudgetRow } from "@/components/dashboard/category-budget-list";
import { OverallLimitForm } from "@/components/dashboard/overall-limit-form";
import { SpendingChart } from "@/components/dashboard/spending-chart";
import { StatCard } from "@/components/dashboard/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { roundMoney, sumLimits } from "@/lib/budget";
import { summarizeSpending, type DailySpendingRow } from "@/lib/spending";
import { createClient } from "@/lib/supabase/server";
import { formatMYR } from "@/lib/utils";

const monthLabel = () =>
  new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "Asia/Kuala_Lumpur" }).format(
    new Date(),
  );

export default async function DashboardPage() {
  const supabase = await createClient();

  // Independent queries run in parallel; RLS scopes each one to the signed-in user.
  const [totalsRes, budgetsRes, settingsRes, rulesRes, dailyRes] = await Promise.all([
    supabase.rpc("dashboard_totals").single<{
      total_income: number;
      total_expenses: number;
      month_expenses: number;
    }>(),
    supabase.from("budgets").select("id, category, monthly_limit").order("category"),
    supabase.from("settings").select("overall_monthly_limit").maybeSingle(),
    supabase.from("category_rules").select("category"),
    supabase.rpc("daily_spending", { days: 30 }),
  ]);

  const failed = [totalsRes, budgetsRes, settingsRes, dailyRes].find((r) => r.error);
  if (failed?.error) {
    // Surfaces in the route error boundary; details stay in the server logs.
    console.error("Dashboard query failed", failed.error);
    throw new Error("Could not load your dashboard data.");
  }

  const totals = {
    income: Number(totalsRes.data?.total_income ?? 0),
    expenses: Number(totalsRes.data?.total_expenses ?? 0),
    month: Number(totalsRes.data?.month_expenses ?? 0),
  };
  const balance = roundMoney(totals.income - totals.expenses);

  const budgets: BudgetRow[] = (budgetsRes.data ?? []).map((b) => ({
    id: b.id as string,
    category: b.category as string,
    monthly_limit: Number(b.monthly_limit),
  }));
  const categoryTotal = sumLimits(budgets);
  const rawOverall = settingsRes.data?.overall_monthly_limit;
  const overallLimit = rawOverall == null ? null : Number(rawOverall);

  // Shape is fixed by the daily_spending() SQL function; summarizeSpending re-validates values.
  const spending = summarizeSpending(dailyRes.data as DailySpendingRow[] | null);
  const chartSummary =
    spending.total === 0
      ? "No spending recorded in the last 30 days."
      : `Spent ${formatMYR(spending.total)} over the last 30 days, about ${formatMYR(spending.average)} a day.` +
        (spending.peak ? ` Highest day: ${spending.peak.label}, ${formatMYR(spending.peak.total)}.` : "");

  const budgeted = new Set(budgets.map((b) => b.category));
  const suggestions = [...new Set((rulesRes.data ?? []).map((r) => r.category as string))]
    .filter((c) => !budgeted.has(c))
    .sort();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">All-time totals, and your budget for {monthLabel()}.</p>
      </div>

      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-3">
        <StatCard title="Total income" value={totals.income} icon={TrendingUp} tone="positive" />
        <StatCard title="Total expenses" value={totals.expenses} icon={TrendingDown} />
        <StatCard
          title="Current balance"
          value={balance}
          icon={Scale}
          tone={balance < 0 ? "negative" : "default"}
          hint="Income minus expenses"
        />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Budget for {monthLabel()}</CardTitle>
          <CardDescription>Spent this month so far: {formatMYR(totals.month)}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <BudgetBar
            id="bar-categories"
            label="Against category limits"
            spent={totals.month}
            limit={categoryTotal}
            emptyText="Add category limits below to track spending against their total."
          />
          <BudgetBar
            id="bar-overall"
            label="Against overall monthly limit"
            spent={totals.month}
            limit={overallLimit}
            emptyText="Set an overall monthly limit below to track it here."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Spending, last 30 days</CardTitle>
          <CardDescription>{chartSummary}</CardDescription>
        </CardHeader>
        <CardContent>
          {spending.total === 0 ? (
            <p className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
              Import a statement to see your daily spending here.
            </p>
          ) : (
            <SpendingChart points={spending.points} summary={chartSummary} />
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
              Total: {formatMYR(categoryTotal)}. Saving an existing name updates its limit.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <CategoryBudgetList budgets={budgets} />
            <CategoryBudgetForm suggestions={suggestions} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
