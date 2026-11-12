"use server";

import { revalidatePath } from "next/cache";
import { parseEntryForm } from "@/lib/entries/validate-entry";
import { createClient } from "@/lib/supabase/server";

export interface EntryFormState {
  error?: string;
  field?: string;
  savedId?: string;
  /** Changes on every successful save so the form can reset itself. */
  savedAt?: number;
}

/** Server Action: validate and insert an entry. Receipts are uploaded by the browser beforehand. */
export async function createEntry(_prev: EntryFormState, formData: FormData): Promise<EntryFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const parsed = parseEntryForm(formData, user.id);
  if ("error" in parsed) return parsed;

  const { data, error } = await supabase
    .from("entries")
    .insert({ ...parsed, user_id: user.id })
    .select("id")
    .single();

  if (error) {
    console.error("Create entry failed", error);
    return { error: "Could not save the entry. Please try again." };
  }

  revalidatePath("/");
  revalidatePath("/entries");
  return { savedId: data.id as string, savedAt: Date.now() };
}
