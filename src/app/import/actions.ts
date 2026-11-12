"use server";

import { revalidatePath } from "next/cache";
import { isMatchable } from "@/lib/entries/match";
import { UUID_RE, validateImportRows, type ImportRow } from "@/lib/import/validate-import";
import { createClient } from "@/lib/supabase/server";

export interface AccountOption {
  id: string;
  name: string;
  type: "savings" | "credit_card";
}

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const DEDUPE_KEY = /^[0-9a-f]{64}$/;
const MAX_KEYS = 2000;
const LOOKUP_CHUNK = 150; // keeps the PostgREST `in.(...)` URL well under length limits

/** Server Actions are public endpoints: always re-check the session. RLS is the backstop. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function createAccount(name: string): Promise<Result<AccountOption>> {
  const clean = typeof name === "string" ? name.replace(/\s+/g, " ").trim() : "";
  if (clean.length < 1 || clean.length > 100) return { ok: false, error: "Enter an account name (1–100 characters)." };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const { data, error } = await supabase
    .from("accounts")
    .insert({ user_id: user.id, name: clean, type: "savings" })
    .select("id, name, type")
    .single();

  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "You already have an account with that name." : "Could not create the account.",
    };
  }
  return { ok: true, data: data as AccountOption };
}

/** Which of these dedupe keys are already stored for the signed-in user. */
export async function findExistingKeys(keys: string[]): Promise<Result<string[]>> {
  if (!Array.isArray(keys) || keys.length > MAX_KEYS || !keys.every((k) => typeof k === "string" && DEDUPE_KEY.test(k))) {
    return { ok: false, error: "Invalid duplicate check request." };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const existing: string[] = [];
  for (let i = 0; i < keys.length; i += LOOKUP_CHUNK) {
    const { data, error } = await supabase
      .from("transactions")
      .select("dedupe_key")
      .eq("user_id", user.id)
      .in("dedupe_key", keys.slice(i, i + LOOKUP_CHUNK));
    if (error) return { ok: false, error: "Could not check for duplicates." };
    existing.push(...data.map((r) => r.dedupe_key as string));
  }
  return { ok: true, data: existing };
}

/**
 * Inserts one chunk of rows. Rows whose dedupe key already exists are skipped
 * by the unique index (ON CONFLICT DO NOTHING), so re-importing is always safe.
 */
export async function importTransactions(
  accountId: string,
  rows: unknown,
): Promise<Result<{ inserted: number; skipped: number; matched: number; matchFailed: number }>> {
  if (typeof accountId !== "string" || !UUID_RE.test(accountId)) return { ok: false, error: "Pick an account first." };
  const validated = validateImportRows(rows);
  if (!validated.ok) return { ok: false, error: validated.error };

  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!account) return { ok: false, error: "That account was not found." };

  const payload = validated.rows.map((row) => ({ ...row, user_id: user.id, account_id: accountId }));
  const { data, error } = await supabase
    .from("transactions")
    .upsert(payload, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true })
    .select("id, dedupe_key");

  if (error) {
    console.error("Import failed", error);
    return { ok: false, error: "Could not save the transactions. Nothing in this batch was imported." };
  }

  const inserted = data?.length ?? 0;
  const links = await linkEntries(
    supabase,
    user.id,
    validated.rows,
    validated.matchEntryIds,
    new Map((data ?? []).map((r) => [r.dedupe_key as string, r.id as string])),
  );

  revalidatePath("/");
  revalidatePath("/statements");
  revalidatePath("/expenses");
  revalidatePath("/entries");
  return { ok: true, data: { inserted, skipped: payload.length - inserted, ...links } };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Links matched entries to the statement rows just inserted. Every pair is
 * re-checked here (the client only proposes): same user, unmatched bank entry,
 * same type, exact amount, at most MATCH_WINDOW_DAYS apart. Rows that were
 * skipped as duplicates have no new id and aren't linked.
 */
async function linkEntries(
  supabase: Supabase,
  userId: string,
  rows: ImportRow[],
  matchEntryIds: Array<string | null>,
  insertedIdByKey: Map<string, string>,
): Promise<{ matched: number; matchFailed: number }> {
  const proposals = rows
    .map((row, i) => ({ row, entryId: matchEntryIds[i], txId: insertedIdByKey.get(row.dedupe_key) }))
    .filter((p): p is { row: ImportRow; entryId: string; txId: string } => Boolean(p.entryId && p.txId));
  if (proposals.length === 0) return { matched: 0, matchFailed: 0 };

  const { data: entries, error } = await supabase
    .from("entries")
    .select("id, date, amount, type")
    .eq("user_id", userId)
    .eq("payment_method", "bank")
    .is("transaction_id", null)
    .in(
      "id",
      proposals.map((p) => p.entryId),
    );
  if (error) {
    console.error("Match lookup failed", error);
    return { matched: 0, matchFailed: proposals.length };
  }
  const byId = new Map((entries ?? []).map((e) => [e.id as string, e]));

  let matched = 0;
  for (const { row, entryId, txId } of proposals) {
    const e = byId.get(entryId);
    const ok =
      e &&
      isMatchable(
        { date: row.date, type: row.type, amountCents: Math.round(row.amount * 100) },
        { id: entryId, date: e.date as string, type: e.type as "income" | "expense", amountCents: Math.round(Number(e.amount) * 100) },
      );
    if (!ok) continue;
    // `transaction_id is null` guards against a concurrent link; the DB trigger re-checks owner and type.
    const { data: linked } = await supabase
      .from("entries")
      .update({ transaction_id: txId })
      .eq("id", entryId)
      .eq("user_id", userId)
      .is("transaction_id", null)
      .select("id");
    if (linked?.length) matched++;
  }
  return { matched, matchFailed: proposals.length - matched };
}

export interface MatchCandidate {
  id: string;
  date: string;
  amount: number;
  type: "income" | "expense";
  merchant: string | null;
  category: string;
}

/** Unmatched bank entries in [from, to] (the statement's dates widened by the match window). */
export async function findMatchCandidates(from: string, to: string): Promise<Result<MatchCandidate[]>> {
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (typeof from !== "string" || typeof to !== "string" || !iso.test(from) || !iso.test(to) || from > to) {
    return { ok: false, error: "Invalid date range." };
  }
  const { supabase, user } = await requireUser();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const { data, error } = await supabase
    .from("entries")
    .select("id, date, amount, type, merchant, category")
    .eq("user_id", user.id)
    .eq("payment_method", "bank")
    .is("transaction_id", null)
    .gte("date", from)
    .lte("date", to)
    .order("date")
    .limit(2000);
  if (error) return { ok: false, error: "Could not load your entries for matching." };

  return {
    ok: true,
    data: (data ?? []).map((e) => ({
      id: e.id as string,
      date: e.date as string,
      amount: Number(e.amount),
      type: e.type as "income" | "expense",
      merchant: (e.merchant as string | null) ?? null,
      category: e.category as string,
    })),
  };
}
