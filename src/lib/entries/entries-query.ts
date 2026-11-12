// URL state for /entries. Pure and unit tested.
import { sanitizeSearch } from "@/lib/expenses-query";
import { isMonth } from "@/lib/month";

export const ENTRIES_PAGE_SIZE = 20;

export type EntryStatusFilter = "" | "matched" | "awaiting" | "cash";
export type EntryTypeFilter = "" | "income" | "expense";

export interface EntryParams {
  q: string;
  month: string; // "" = all months
  type: EntryTypeFilter;
  status: EntryStatusFilter;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export function parseEntryParams(raw: RawParams): EntryParams {
  const type = first(raw.type);
  const status = first(raw.status);
  const month = first(raw.month);
  const page = Number.parseInt(first(raw.page), 10);
  return {
    q: sanitizeSearch(first(raw.q)),
    month: isMonth(month) ? month : "",
    type: type === "income" || type === "expense" ? type : "",
    status: status === "matched" || status === "awaiting" || status === "cash" ? status : "",
    page: Number.isFinite(page) && page >= 1 ? Math.min(page, 10_000) : 1,
  };
}

/** Builds /entries?… with defaults omitted. Changing any filter resets to page 1. */
export function entriesHref(current: EntryParams, changes: Partial<EntryParams> = {}): string {
  const next = { ...current, ...changes };
  if (!("page" in changes) && Object.keys(changes).length > 0) next.page = 1;
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.month) params.set("month", next.month);
  if (next.type) params.set("type", next.type);
  if (next.status) params.set("status", next.status);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/entries?${qs}` : "/entries";
}

export type EntryMatchState = "matched" | "awaiting" | "cash";

export function entryMatchState(e: { payment_method: string; transaction_id: string | null }): EntryMatchState {
  if (e.payment_method === "cash") return "cash";
  return e.transaction_id ? "matched" : "awaiting";
}

export const MATCH_STATE_LABEL: Record<EntryMatchState, string> = {
  matched: "Matched to statement",
  awaiting: "Awaiting statement",
  cash: "Cash",
};
