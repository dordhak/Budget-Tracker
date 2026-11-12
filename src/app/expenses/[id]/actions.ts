"use server";

import { revalidatePath } from "next/cache";
import { UUID_RE } from "@/lib/import/validate-import";
import { createClient } from "@/lib/supabase/server";
import { escapeLike, parseTransactionUpdate } from "@/lib/transaction-update";

export interface EditState {
  error?: string;
  field?: string;
  success?: string;
}

// Lower wins (see categorize.ts). Rules you save yourself must beat the seeded defaults (5–100).
const RULE_PRIORITY = 1;

/** Server Action: update category + notes, optionally saving a keyword rule. RLS is the backstop. */
export async function updateTransaction(id: string, _prev: EditState, formData: FormData): Promise<EditState> {
  if (typeof id !== "string" || !UUID_RE.test(id)) return { error: "Unknown transaction." };

  const parsed = parseTransactionUpdate(formData);
  if ("error" in parsed) return parsed;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session expired. Please sign in again." };

  const { data: updated, error } = await supabase
    .from("transactions")
    .update({ category: parsed.category, notes: parsed.notes })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error) return { error: "Could not save your changes. Please try again." };
  if (!updated) return { error: "This transaction no longer exists." };

  let ruleMessage = "";
  if (parsed.rule) {
    const ruleError = await saveRule(supabase, user.id, parsed.rule.keyword, parsed.rule.category);
    if (ruleError) {
      revalidate(id);
      return { error: `Saved the transaction, but not the rule: ${ruleError}`, field: "keyword" };
    }
    ruleMessage = ` Future imports matching “${parsed.rule.keyword}” will use ${parsed.rule.category}.`;
  }

  revalidate(id);
  return { success: `Saved.${ruleMessage}` };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Insert or update a rule; keywords are unique per user, case-insensitively. */
async function saveRule(supabase: Supabase, userId: string, keyword: string, category: string): Promise<string | null> {
  const { data: existing, error: findError } = await supabase
    .from("category_rules")
    .select("id")
    .eq("user_id", userId)
    .ilike("keyword", escapeLike(keyword))
    .maybeSingle();
  if (findError) return "could not look up existing rules.";

  if (existing) {
    const { error } = await supabase
      .from("category_rules")
      .update({ category, priority: RULE_PRIORITY })
      .eq("id", existing.id)
      .eq("user_id", userId);
    return error ? "could not update the rule." : null;
  }

  const { error } = await supabase
    .from("category_rules")
    .insert({ user_id: userId, keyword, category, priority: RULE_PRIORITY });
  if (error?.code === "23505") return "a rule with that keyword was just created; try again.";
  return error ? "could not create the rule." : null;
}

function revalidate(id: string) {
  revalidatePath(`/expenses/${id}`);
  revalidatePath("/expenses");
  revalidatePath("/");
}
