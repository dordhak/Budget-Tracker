// Calendar-month helpers ("YYYY-MM"). Pure, timezone-independent, unit tested.

export const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function isMonth(value: unknown): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

/** "2025-08-14" -> "2025-08". */
export const monthOf = (iso: string) => iso.slice(0, 7);

/** First and last ISO day of a month. */
export function monthBounds(month: string): { from: string; to: string } {
  const [y, m] = month.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, "0")}` };
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The `count` months ending at `month`, oldest first. */
export function lastMonths(month: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => shiftMonth(month, i - (count - 1)));
}

const longFmt = new Intl.DateTimeFormat("en-MY", { month: "long", year: "numeric", timeZone: "UTC" });
const toDate = (month: string) => new Date(`${month}-01T00:00:00Z`);
// Fixed list: Intl's "short" month varies by locale/runtime (e.g. "Sept" in en-MY).
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "August 2025" */
export const monthLabel = (month: string) => longFmt.format(toDate(month));
/** "Aug" */
export const monthShort = (month: string) => SHORT[Number(month.slice(5, 7)) - 1] ?? month;

/** Every ISO day of the month, or up to `until` if that falls inside it. */
export function daysOfMonth(month: string, until?: string): string[] {
  const { from, to } = monthBounds(month);
  const end = until && until >= from && until < to ? until : to;
  const days: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); d.toISOString().slice(0, 10) <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    days.push(d.toISOString().slice(0, 10));
  }
  return days;
}
