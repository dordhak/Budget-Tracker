// Server-side loaders for the dashboards. Each query is scoped by RLS to the signed-in user.
import { todayIso } from "@/lib/entries/validate-entry";
import { isMonth, lastMonths, monthBounds } from "@/lib/month";
import type { createClient } from "@/lib/supabase/server";
import type { EntryLike, TransactionLike } from "./aggregate";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const SERIES_MONTHS = 6;
const ROW_LIMIT = 10_000;
/** Entries just outside the window can still be matched to rows inside it (±3 days). */
const LINK_MARGIN_DAYS = 7;

/** `?month=` if valid and not in the future, else the current month (Malaysia time). */
export function resolveMonth(raw: string | string[] | undefined): { month: string; current: string } {
  const current = todayIso().slice(0, 7);
  const value = Array.isArray(raw) ? raw[0] : raw;
  return { month: isMonth(value) && value <= current ? value : current, current };
}

/** The 6-month window ending at `month`. */
export function windowFor(month: string) {
  const months = lastMonths(month, SERIES_MONTHS);
  return { months, from: monthBounds(months[0]).from, to: monthBounds(month).to };
}

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export interface StatementTx extends TransactionLike {
  account_id: string | null;
  balance: number | string | null;
}

export async function loadWindow(supabase: Supabase, month: string) {
  const { months, from, to } = windowFor(month);
  const [entriesRes, txRes, latestRes] = await Promise.all([
    supabase
      .from("entries")
      .select("id, date, type, amount, category, merchant, payment_method, transaction_id")
      .gte("date", shift(from, -LINK_MARGIN_DAYS))
      .lte("date", shift(to, LINK_MARGIN_DAYS))
      .order("date", { ascending: false })
      .limit(ROW_LIMIT),
    supabase
      .from("transactions")
      .select("id, date, type, amount, category, account_id, balance")
      .gte("date", from)
      .lte("date", to)
      .limit(ROW_LIMIT),
    // Latest statement row overall: how far imported statements reach.
    supabase.from("transactions").select("date").order("date", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const failed = [entriesRes, txRes, latestRes].find((r) => r.error);
  if (failed?.error) {
    console.error("Dashboard query failed", failed.error);
    throw new Error("Could not load your dashboard data.");
  }

  const allEntries = (entriesRes.data ?? []) as Array<EntryLike & { merchant: string | null }>;
  return {
    months,
    from,
    to,
    /** Entries inside the window (the margin rows only matter for the link set). */
    entries: allEntries.filter((e) => e.date >= from && e.date <= to),
    /** Statement rows some entry is matched to, including entries in the margin. */
    linkedTxIds: new Set(allEntries.map((e) => e.transaction_id).filter((id): id is string => Boolean(id))),
    transactions: (txRes.data ?? []) as StatementTx[],
    coveredUntil: (latestRes.data?.date as string | undefined) ?? null,
  };
}
