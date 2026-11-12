"use server";

import { revalidatePath } from "next/cache";
import { parseCategory, parseMoney } from "@/lib/budget";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
  success?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Server Actions are public endpoints: always re-check the session. RLS is the backstop. */
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function setOverallLimit(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = String(formData.get("overall_monthly_limit") ?? "").trim();
  // An empty field clears the overall limit.
  const limit = raw === "" ? null : parseMoney(raw);
  if (raw !== "" && limit === null) return { error: "Enter an amount between 0 and 10,000,000 (max 2 decimals)." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { error } = await supabase
    .from("settings")
    .upsert(
      { user_id: user.id, overall_monthly_limit: limit, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) return { error: "Could not save the overall limit. Please try again." };

  revalidatePath("/");
  return { success: limit === null ? "Overall limit cleared." : "Overall limit saved." };
}

export async function upsertCategoryBudget(_prev: FormState, formData: FormData): Promise<FormState> {
  const category = parseCategory(formData.get("category"));
  if (!category) return { error: "Enter a category name (1–60 characters)." };
  const limit = parseMoney(String(formData.get("monthly_limit") ?? ""));
  if (limit === null) return { error: "Enter a limit between 0 and 10,000,000 (max 2 decimals)." };

  const { supabase, user } = await requireUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { error } = await supabase
    .from("budgets")
    .upsert({ user_id: user.id, category, monthly_limit: limit }, { onConflict: "user_id,category" });
  if (error) return { error: "Could not save that budget. Please try again." };

  revalidatePath("/");
  return { success: `Saved ${category}.` };
}

export async function deleteCategoryBudget(id: string): Promise<void> {
  if (!UUID_RE.test(id)) return;
  const { supabase, user } = await requireUser();
  if (!user) return;

  await supabase.from("budgets").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/");
}
