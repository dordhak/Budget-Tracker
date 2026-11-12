import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { CategoryRule } from "@/lib/import";
import { todayIso } from "@/lib/entries/validate-entry";
import { createClient } from "@/lib/supabase/server";
import { EntryForm } from "./entry-form";

export const metadata: Metadata = { title: "Add entry · Budget Tracker" };

export default async function NewEntryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/entries/new");

  const [rulesRes, entryCats, txCats, budgetCats] = await Promise.all([
    supabase.from("category_rules").select("keyword, category, priority"),
    supabase.from("entries").select("category").limit(5000),
    supabase.from("transactions").select("category").limit(5000),
    supabase.from("budgets").select("category"),
  ]);
  const rules = (rulesRes.data ?? []) as CategoryRule[];
  const categories = [
    ...new Set(
      [...rules, ...(entryCats.data ?? []), ...(txCats.data ?? []), ...(budgetCats.data ?? [])].map(
        (r) => r.category as string,
      ),
    ),
  ].sort((a, b) => a.localeCompare(b));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add entry</h1>
        <p className="text-sm text-muted-foreground">
          Record income or spending as it happens. When your statement arrives, bank entries are matched to it
          automatically.
        </p>
      </div>
      <EntryForm userId={user.id} today={todayIso()} rules={rules} categories={categories} />
    </div>
  );
}
