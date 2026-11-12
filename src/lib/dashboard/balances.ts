// Opening/closing balance of an account for a period, from statement rows that
// carry a running balance. Rows imported together share a timestamp, so their
// order within a day can't be trusted; instead we follow the balance chain:
// each row moves the balance from `before` to `after`. The opening balance is
// the `before` no row ends at; the closing balance is the `after` no row starts from.
import { toCents } from "./aggregate";

export interface BalanceRow {
  date: string;
  type: "income" | "expense";
  amount: number | string;
  balance: number | string | null;
}

export interface PeriodBalance {
  openingCents: number;
  closingCents: number;
  /** false when the chain had gaps or branches; the values then come from date order. */
  exact: boolean;
}

export function periodBalance(rows: ReadonlyArray<BalanceRow>): PeriodBalance | null {
  const steps = rows
    .filter((r) => r.balance !== null && r.balance !== undefined && r.balance !== "")
    .map((r) => {
      const after = toCents(r.balance as number | string);
      const amount = toCents(r.amount);
      return { date: r.date, after, before: r.type === "income" ? after - amount : after + amount };
    });
  if (steps.length === 0) return null;

  // Multisets, so repeated balances (e.g. a debit and its refund) are handled.
  const count = (values: number[]) => values.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<number, number>());
  const befores = count(steps.map((s) => s.before));
  const afters = count(steps.map((s) => s.after));
  const minus = (a: Map<number, number>, b: Map<number, number>) =>
    [...a].flatMap(([v, n]) => Array<number>(Math.max(0, n - (b.get(v) ?? 0))).fill(v));

  const starts = minus(befores, afters);
  const ends = minus(afters, befores);
  if (starts.length === 1 && ends.length === 1) {
    return { openingCents: starts[0], closingCents: ends[0], exact: true };
  }

  // Fallback (gaps, e.g. a skipped row): earliest/latest by date.
  const sorted = [...steps].sort((a, b) => a.date.localeCompare(b.date));
  return { openingCents: sorted[0].before, closingCents: sorted[sorted.length - 1].after, exact: false };
}
