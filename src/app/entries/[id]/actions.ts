"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isManuallyLinkable } from "@/lib/entries/match";
import { isOwnReceiptPath, parseEntryForm } from "@/lib/entries/validate-entry";
import { UUID_RE } from "@/lib/import/validate-import";
import { createClient } from "@/lib/supabase/server";

export interface EntryActionState {
  error?: string;
  field?: string;
  success?: string;
}

type Result = { ok: true } | { ok: false; error: string };

/** Server Actions are public endpoints: always re-check the session. RLS is the backstop. */
async function session() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

function revalidate(id: string) {
  revalidatePath(`/entries/${id}`);
  revalidatePath("/entries");
  revalidatePath("/");
  revalidatePath("/statements");
}

async function loadEntry(supabase: Awaited<ReturnType<typeof createClient>>, id: string, userId: string) {
  const { data } = await supabase
    .from("entries")
    .select("id, date, type, payment_method, transaction_id, receipt_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  return data as {
    id: string;
    date: string;
    type: "income" | "expense";
    payment_method: "bank" | "cash";
    transaction_id: string | null;
    receipt_path: string | null;
  } | null;
}

export async function updateEntry(id: string, _prev: EntryActionState, formData: FormData): Promise<EntryActionState> {
  if (!UUID_RE.test(id)) return { error: "Unknown entry." };
  const { supabase, user } = await session();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const parsed = parseEntryForm(formData, user.id);
  if ("error" in parsed) return parsed;

  const current = await loadEntry(supabase, id, user.id);
  if (!current) return { error: "This entry no longer exists." };
  if (current.transaction_id && (parsed.type !== current.type || parsed.payment_method === "cash")) {
    return {
      error: "This entry is matched to a statement row. Unlink it first to change its type or mark it as cash.",
      field: parsed.type !== current.type ? "type" : "payment_method",
    };
  }

  // Only editable columns: the receipt and the statement link are managed separately.
  const { error } = await supabase
    .from("entries")
    .update({
      date: parsed.date,
      amount: parsed.amount,
      type: parsed.type,
      category: parsed.category,
      merchant: parsed.merchant,
      notes: parsed.notes,
      payment_method: parsed.payment_method,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) {
    console.error("Update entry failed", error);
    return { error: "Could not save your changes. Please try again." };
  }

  revalidate(id);
  return { success: "Saved." };
}

export async function deleteEntry(id: string): Promise<Result> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Unknown entry." };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const current = await loadEntry(supabase, id, user.id);
  if (!current) return { ok: false, error: "This entry no longer exists." };

  const { error } = await supabase.from("entries").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not delete the entry." };

  // The statement row (if linked) stays; only the receipt file goes with the entry.
  if (current.receipt_path) await supabase.storage.from("receipts").remove([current.receipt_path]);

  revalidatePath("/entries");
  revalidatePath("/");
  redirect("/entries");
}

export async function linkEntry(id: string, transactionId: string): Promise<Result> {
  if (!UUID_RE.test(id) || !UUID_RE.test(transactionId)) return { ok: false, error: "Unknown entry or statement row." };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const entry = await loadEntry(supabase, id, user.id);
  if (!entry) return { ok: false, error: "This entry no longer exists." };
  if (entry.transaction_id) return { ok: false, error: "Unlink the current statement row first." };

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, date, type")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!tx) return { ok: false, error: "That statement row was not found." };
  if (!isManuallyLinkable(entry, { date: tx.date as string, type: tx.type as "income" | "expense" })) {
    return { ok: false, error: "Only a bank entry of the same type, within 7 days, can be linked." };
  }

  const { data, error } = await supabase
    .from("entries")
    .update({ transaction_id: transactionId })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("transaction_id", null)
    .select("id");
  if (error?.code === "23505") return { ok: false, error: "That statement row is already matched to another entry." };
  if (error || !data?.length) return { ok: false, error: "Could not link the statement row." };

  revalidate(id);
  return { ok: true };
}

export async function unlinkEntry(id: string): Promise<Result> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Unknown entry." };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const { error } = await supabase.from("entries").update({ transaction_id: null }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not unlink the statement row." };
  revalidate(id);
  return { ok: true };
}

/** Called after the browser uploaded a new receipt into the user's folder. */
export async function attachReceipt(id: string, path: string, source: "receipt_image" | "receipt_pdf"): Promise<Result> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Unknown entry." };
  if (source !== "receipt_image" && source !== "receipt_pdf") return { ok: false, error: "Invalid receipt type." };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };
  if (!isOwnReceiptPath(path, user.id)) return { ok: false, error: "Invalid receipt upload." };

  const current = await loadEntry(supabase, id, user.id);
  if (!current) return { ok: false, error: "This entry no longer exists." };

  const { error } = await supabase
    .from("entries")
    .update({ receipt_path: path, source })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not attach the receipt." };
  // Replace: remove the previous file once the new one is saved.
  if (current.receipt_path && current.receipt_path !== path) {
    await supabase.storage.from("receipts").remove([current.receipt_path]);
  }
  revalidate(id);
  return { ok: true };
}

export async function removeReceipt(id: string): Promise<Result> {
  if (!UUID_RE.test(id)) return { ok: false, error: "Unknown entry." };
  const { supabase, user } = await session();
  if (!user) return { ok: false, error: "Your session expired. Please sign in again." };

  const current = await loadEntry(supabase, id, user.id);
  if (!current?.receipt_path) return { ok: true };

  const { error } = await supabase.from("entries").update({ receipt_path: null }).eq("id", id).eq("user_id", user.id);
  if (error) return { ok: false, error: "Could not remove the receipt." };
  await supabase.storage.from("receipts").remove([current.receipt_path]);
  revalidate(id);
  return { ok: true };
}
