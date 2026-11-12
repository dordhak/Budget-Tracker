// URL state for /expenses (q, category, page). Pure and unit tested.

export const PAGE_SIZE = 20;
export const MAX_SEARCH = 100;
const MAX_PAGE = 10_000;

export interface ExpenseParams {
  q: string;
  category: string;
  page: number;
}

type RawParams = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Keeps letters, digits, spaces and the punctuation found in bank descriptions.
 * Drops PostgREST filter syntax (, ( ) " \) and LIKE wildcards (% _), so user
 * input can be placed inside an `.or(...ilike...)` filter without escaping issues.
 */
export function sanitizeSearch(input: string): string {
  return input
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}\s\-./&@'#*+:]/gu, " ")
    .replace(/\*/g, " ") // PostgREST treats * as a wildcard in like patterns
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_SEARCH);
}

export function parseExpenseParams(raw: RawParams): ExpenseParams {
  const pageNum = Number.parseInt(first(raw.page), 10);
  const category = first(raw.category).replace(/\s+/g, " ").trim().slice(0, 60);
  return {
    q: sanitizeSearch(first(raw.q)),
    category,
    page: Number.isFinite(pageNum) && pageNum >= 1 ? Math.min(pageNum, MAX_PAGE) : 1,
  };
}

/** Builds /expenses?… with defaults omitted. Changing q or category resets to page 1. */
export function expensesHref(current: ExpenseParams, changes: Partial<ExpenseParams> = {}): string {
  const next = { ...current, ...changes };
  if (("q" in changes || "category" in changes) && !("page" in changes)) next.page = 1;

  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.category) params.set("category", next.category);
  if (next.page > 1) params.set("page", String(next.page));
  const qs = params.toString();
  return qs ? `/expenses?${qs}` : "/expenses";
}

export function pageCount(total: number, pageSize = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
}

/** Inclusive row range for Supabase `.range(from, to)`. */
export function pageRange(page: number, pageSize = PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}

/** Compact page list with gaps, e.g. [1, "…", 4, 5, 6, "…", 12]. */
export function visiblePages(page: number, total: number): Array<number | "…"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set([1, total, page - 1, page, page + 1].filter((p) => p >= 1 && p <= total));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push("…");
    out.push(p);
  });
  return out;
}
