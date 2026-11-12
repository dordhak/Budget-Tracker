import type { ParsedTransaction } from "./types";

/**
 * Idempotency keys for savings rows: SHA-256 of
 *   version | account | date | type | amount | running balance | occurrence
 *
 * The description is deliberately NOT part of the key: it is re-assembled
 * heuristically on reflowed pages and may change as the parser improves, which
 * would make a re-import look like new rows. Date + amount + running balance is
 * already unique for savings rows; the occurrence counter covers the rare case of
 * identical rows (e.g. a debit, its refund, then the same debit again on one day).
 */
export const DEDUPE_VERSION = "savings-v1";

type KeyFields = Pick<ParsedTransaction, "date" | "type" | "amountCents" | "balanceCents">;

export function dedupeMaterial(rows: ReadonlyArray<KeyFields>, accountId: string): string[] {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = [DEDUPE_VERSION, accountId, r.date, r.type, r.amountCents, r.balanceCents ?? ""].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}|#${n}`;
  });
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function computeDedupeKeys(rows: ReadonlyArray<KeyFields>, accountId: string): Promise<string[]> {
  return Promise.all(dedupeMaterial(rows, accountId).map(sha256Hex));
}
