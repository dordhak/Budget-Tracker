// Dashboard calculations shared by the Budget and Statement dashboards.
// Pure, integer-cent maths, unit tested. Data volumes are personal-scale
// (a few hundred rows per month), so this runs in TypeScript, not SQL.
import { daysOfMonth, monthOf, monthShort } from "@/lib/month";

export type Kind = "income" | "expense";

export interface Item {
  date: string; // ISO
  type: Kind;
  amountCents: number;
  category: string;
}

export interface EntryLike {
  id: string;
  date: string;
  type: Kind;
  amount: number | string;
  category: string;
  payment_method: "bank" | "cash";
  transaction_id: string | null;
}

export interface TransactionLike {
  id: string;
  date: string;
  type: Kind;
  amount: number | string;
  category: string;
}

export const toCents = (amount: number | string) => Math.round(Number(amount) * 100);

/**
 * Budget view ("safe to spend"): everything you logged, plus statement rows that
 * no entry is matched to (things you forgot to log). A matched pair counts once,
 * with your entry's category.
 */
export function budgetItems(
  entries: ReadonlyArray<EntryLike>,
  transactions: ReadonlyArray<TransactionLike>,
  /** Statement rows matched to any entry, including entries outside the date window. */
  linkedTxIds?: ReadonlySet<string>,
): Item[] {
  const linked = linkedTxIds ?? new Set(entries.map((e) => e.transaction_id).filter((id): id is string => Boolean(id)));
  return [
    ...entries.map((e) => ({ date: e.date, type: e.type, amountCents: toCents(e.amount), category: e.category })),
    ...transactions
      .filter((t) => !linked.has(t.id))
      .map((t) => ({ date: t.date, type: t.type, amountCents: toCents(t.amount), category: t.category })),
  ];
}

/** Statement view: bank facts only. */
export function statementItems(transactions: ReadonlyArray<TransactionLike>): Item[] {
  return transactions.map((t) => ({ date: t.date, type: t.type, amountCents: toCents(t.amount), category: t.category }));
}

export interface Totals {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  count: number;
}

export function monthTotals(items: ReadonlyArray<Item>, month: string): Totals {
  let incomeCents = 0;
  let expenseCents = 0;
  let count = 0;
  for (const i of items) {
    if (monthOf(i.date) !== month) continue;
    count++;
    if (i.type === "income") incomeCents += i.amountCents;
    else expenseCents += i.amountCents;
  }
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents, count };
}

export interface CategorySlice {
  category: string;
  cents: number;
  /** 0–100, one decimal. */
  percent: number;
}

/**
 * Spending by category for the month, largest first. Categories beyond `maxSlices - 1`
 * are folded into "Other" so the donut stays readable.
 */
export function categoryBreakdown(items: ReadonlyArray<Item>, month: string, maxSlices = 7): CategorySlice[] {
  const byCategory = new Map<string, number>();
  for (const i of items) {
    if (i.type !== "expense" || monthOf(i.date) !== month) continue;
    byCategory.set(i.category, (byCategory.get(i.category) ?? 0) + i.amountCents);
  }
  const total = [...byCategory.values()].reduce((s, c) => s + c, 0);
  if (total === 0) return [];

  let slices = [...byCategory].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents || a.category.localeCompare(b.category));
  if (slices.length > maxSlices) {
    const kept = slices.slice(0, maxSlices - 1);
    const rest = slices.slice(maxSlices - 1).reduce((s, x) => s + x.cents, 0);
    slices = [...kept, { category: "Other", cents: rest }];
  }
  return slices.map((s) => ({ ...s, percent: Math.round((s.cents / total) * 1000) / 10 }));
}

export interface MonthPoint {
  month: string;
  label: string; // "Aug"
  incomeCents: number;
  expenseCents: number;
}

export function monthlySeries(items: ReadonlyArray<Item>, months: ReadonlyArray<string>): MonthPoint[] {
  const index = new Map(months.map((m, i) => [m, i]));
  const points = months.map((month) => ({ month, label: monthShort(month), incomeCents: 0, expenseCents: 0 }));
  for (const i of items) {
    const at = index.get(monthOf(i.date));
    if (at === undefined) continue;
    if (i.type === "income") points[at].incomeCents += i.amountCents;
    else points[at].expenseCents += i.amountCents;
  }
  return points;
}

export interface DayPoint {
  day: string;
  label: string; // "5"
  cents: number;
}

/** Spending per day of the month (zero-filled), stopping at `until` for the current month. */
export function dailySeries(items: ReadonlyArray<Item>, month: string, until?: string): DayPoint[] {
  const days = daysOfMonth(month, until);
  const byDay = new Map(days.map((d) => [d, 0]));
  for (const i of items) {
    if (i.type === "expense" && byDay.has(i.date)) byDay.set(i.date, byDay.get(i.date)! + i.amountCents);
  }
  return days.map((day) => ({ day, label: String(Number(day.slice(8))), cents: byDay.get(day)! }));
}

export interface EntryStatus {
  /** Bank entries this month not matched yet, still inside the statement's reach. */
  awaiting: number;
  /** Bank entries old enough that their statement was imported, yet unmatched. */
  notOnStatement: number;
}

/**
 * `coveredUntil` is the latest statement date imported so far. Bank entries dated on
 * or before it (minus the match window, to allow for posting delays) that are still
 * unmatched are "not on statement"; later ones are just "awaiting statement".
 */
export function entryStatus(
  entries: ReadonlyArray<EntryLike>,
  month: string,
  coveredUntil: string | null,
  windowDays = 3,
): EntryStatus {
  let cutoff: string | null = null;
  if (coveredUntil) {
    const d = new Date(`${coveredUntil}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - windowDays);
    cutoff = d.toISOString().slice(0, 10);
  }
  let awaiting = 0;
  let notOnStatement = 0;
  for (const e of entries) {
    if (e.payment_method !== "bank" || e.transaction_id || monthOf(e.date) !== month) continue;
    if (cutoff && e.date <= cutoff) notOnStatement++;
    else awaiting++;
  }
  return { awaiting, notOnStatement };
}
