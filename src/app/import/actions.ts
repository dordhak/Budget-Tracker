"use server";

import { revalidatePath } from "next/cache";
import { UUID_RE, validateImportRows } from "@/lib/import/validate-import";
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
): Promise<Result<{ inserted: number; skipped: number }>> {
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
    .select("id");

  if (error) {
    console.error("Import failed", error);
    return { ok: false, error: "Could not save the transactions. Nothing in this batch was imported." };
  }

  const inserted = data?.length ?? 0;
  revalidatePath("/");
  revalidatePath("/expenses");
  return { ok: true, data: { inserted, skipped: payload.length - inserted } };
}
