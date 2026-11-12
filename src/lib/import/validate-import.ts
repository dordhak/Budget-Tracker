// Server-side validation for rows sent by the import UI. Server Actions are
// public endpoints, so never trust the client payload. Pure (unit tested).

export const MAX_ROWS_PER_REQUEST = 500;
export const MAX_DESCRIPTION = 500;
export const MAX_MERCHANT = 120;
export const MAX_CATEGORY = 60;
const MAX_AMOUNT = 1_000_000_000;

export interface ImportRowInput {
  date: unknown;
  amount: unknown;
  type: unknown;
  category: unknown;
  description: unknown;
  merchant: unknown;
  balance: unknown;
  dedupe_key: unknown;
  /** Optional: id of one of your entries this statement row should be linked to. */
  match_entry_id?: unknown;
}

export interface ImportRow {
  date: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  description: string;
  merchant: string | null;
  balance: number | null;
  dedupe_key: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DEDUPE_KEY = /^[0-9a-f]{64}$/;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

function isRealDate(iso: string) {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso);
}

/** Money with at most 2 decimals (checked on cents to avoid float noise). */
function isMoney(value: unknown, allowZero: boolean): value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) return false;
  if (Math.abs(value) > MAX_AMOUNT || (!allowZero && value <= 0)) return false;
  return Math.abs(Math.round(value * 100) - value * 100) < 1e-6;
}

export function validateImportRow(input: ImportRowInput): ImportRow | string {
  const date = typeof input.date === "string" ? input.date : "";
  if (!ISO_DATE.test(date) || !isRealDate(date)) return "invalid date";
  if (!isMoney(input.amount, false)) return "invalid amount";
  if (input.type !== "income" && input.type !== "expense") return "invalid type";
  if (input.balance !== null && input.balance !== undefined && !isMoney(input.balance, true)) {
    return "invalid balance";
  }
  if (typeof input.dedupe_key !== "string" || !DEDUPE_KEY.test(input.dedupe_key)) return "invalid dedupe key";

  const merchant = clean(input.merchant, MAX_MERCHANT);
  return {
    date,
    amount: input.amount,
    type: input.type,
    category: clean(input.category, MAX_CATEGORY) || "Uncategorized",
    description: clean(input.description, MAX_DESCRIPTION),
    merchant: merchant || null,
    balance: typeof input.balance === "number" ? input.balance : null,
    dedupe_key: input.dedupe_key,
  };
}

export function validateImportRows(
  rows: unknown,
):
  | { ok: true; rows: ImportRow[]; matchEntryIds: Array<string | null> }
  | { ok: false; error: string } {
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > MAX_ROWS_PER_REQUEST) return { ok: false, error: `Send at most ${MAX_ROWS_PER_REQUEST} rows at a time.` };

  const valid: ImportRow[] = [];
  const matchEntryIds: Array<string | null> = [];
  const keys = new Set<string>();
  const matched = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    const input = (rows[i] ?? {}) as ImportRowInput;
    const result = validateImportRow(input);
    if (typeof result === "string") return { ok: false, error: `Row ${i + 1}: ${result}.` };
    if (keys.has(result.dedupe_key)) return { ok: false, error: `Row ${i + 1}: duplicate dedupe key in request.` };
    keys.add(result.dedupe_key);

    const match = input.match_entry_id ?? null;
    if (match !== null) {
      if (typeof match !== "string" || !UUID_RE.test(match)) return { ok: false, error: `Row ${i + 1}: invalid entry match.` };
      if (matched.has(match)) return { ok: false, error: `Row ${i + 1}: an entry can only match one row.` };
      matched.add(match);
    }
    valid.push(result);
    matchEntryIds.push(match as string | null);
  }
  return { ok: true, rows: valid, matchEntryIds };
}
