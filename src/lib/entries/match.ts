// Matches statement rows to entries you recorded yourself, so a purchase logged
// from a receipt and later seen on the statement is counted once.
// Rule (agreed): same type, exact same amount, dates at most ±3 days apart,
// only bank entries that aren't matched yet. Pure and unit tested.

export const MATCH_WINDOW_DAYS = 3;

export interface MatchRow {
  index: number;
  date: string; // ISO
  type: "income" | "expense";
  amountCents: number;
}

export interface MatchEntry {
  id: string;
  date: string;
  type: "income" | "expense";
  amountCents: number;
}

export type MatchStatus =
  /** One candidate on both sides: safe to link automatically. */
  | "auto"
  /** Several possible pairs: a best guess is pre-selected, the user should confirm. */
  | "suggested"
  | "none";

export interface RowMatch {
  status: MatchStatus;
  /** Pre-selected entry, if any. */
  entryId: string | null;
  /** Every entry that fits this row (for the picker). */
  candidates: string[];
}

/**
 * Linking by hand (entry page) is looser: amounts may differ (card holds,
 * foreign-currency conversion), dates may be up to a week apart.
 */
export const MANUAL_LINK_WINDOW_DAYS = 7;

export function isManuallyLinkable(
  entry: { date: string; type: "income" | "expense"; payment_method: "bank" | "cash" },
  tx: { date: string; type: "income" | "expense" },
): boolean {
  return entry.payment_method === "bank" && entry.type === tx.type && daysApart(entry.date, tx.date) <= MANUAL_LINK_WINDOW_DAYS;
}

export function daysApart(a: string, b: string): number {
  return Math.abs(Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000));
}

export function isMatchable(row: Omit<MatchRow, "index">, entry: MatchEntry, windowDays = MATCH_WINDOW_DAYS): boolean {
  return row.type === entry.type && row.amountCents === entry.amountCents && daysApart(row.date, entry.date) <= windowDays;
}

/**
 * Builds a one-to-one assignment. Pairs are taken closest-date first
 * (ties: earlier row, then earlier entry), so the pre-selection is deterministic.
 */
export function matchRows(
  rows: ReadonlyArray<MatchRow>,
  entries: ReadonlyArray<MatchEntry>,
  windowDays = MATCH_WINDOW_DAYS,
): Map<number, RowMatch> {
  const candidatesByRow = new Map<number, string[]>();
  const rowsByEntry = new Map<string, number[]>();
  const pairs: Array<{ row: MatchRow; entry: MatchEntry; gap: number }> = [];

  for (const row of rows) {
    const list: string[] = [];
    for (const entry of entries) {
      if (!isMatchable(row, entry, windowDays)) continue;
      list.push(entry.id);
      rowsByEntry.set(entry.id, [...(rowsByEntry.get(entry.id) ?? []), row.index]);
      pairs.push({ row, entry, gap: daysApart(row.date, entry.date) });
    }
    candidatesByRow.set(row.index, list);
  }

  pairs.sort(
    (a, b) =>
      a.gap - b.gap ||
      a.row.index - b.row.index ||
      a.entry.date.localeCompare(b.entry.date) ||
      a.entry.id.localeCompare(b.entry.id),
  );
  const chosen = new Map<number, string>();
  const used = new Set<string>();
  for (const { row, entry } of pairs) {
    if (chosen.has(row.index) || used.has(entry.id)) continue;
    chosen.set(row.index, entry.id);
    used.add(entry.id);
  }

  const result = new Map<number, RowMatch>();
  for (const row of rows) {
    const candidates = candidatesByRow.get(row.index) ?? [];
    const entryId = chosen.get(row.index) ?? null;
    const unique = candidates.length === 1 && entryId !== null && (rowsByEntry.get(entryId)?.length ?? 0) === 1;
    result.set(row.index, {
      status: entryId === null ? "none" : unique ? "auto" : "suggested",
      entryId,
      candidates,
    });
  }
  return result;
}

/**
 * Picking an entry for one row takes it away from any other row, keeping the
 * assignment one-to-one. `null` clears the row.
 */
export function chooseMatch(
  selection: ReadonlyMap<number, string | null>,
  rowIndex: number,
  entryId: string | null,
): Map<number, string | null> {
  const next = new Map(selection);
  if (entryId !== null) {
    for (const [index, id] of next) if (id === entryId && index !== rowIndex) next.set(index, null);
  }
  next.set(rowIndex, entryId);
  return next;
}

/** Bank entries in the statement period that no row will match ("not on statement"). */
export function unmatchedInPeriod(
  entries: ReadonlyArray<MatchEntry>,
  matchedIds: ReadonlySet<string>,
  period: { from: string; to: string },
): MatchEntry[] {
  return entries.filter((e) => !matchedIds.has(e.id) && e.date >= period.from && e.date <= period.to);
}
