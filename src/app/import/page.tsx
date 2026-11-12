import type { Metadata } from "next";
import type { CategoryRule } from "@/lib/import";
import { createClient } from "@/lib/supabase/server";
import type { AccountOption } from "./actions";
import { StatementImporter } from "./statement-importer";

export const metadata: Metadata = { title: "Import · Budget Tracker" };

/** Server Component: loads the user's accounts and keyword rules, then hands off to the client importer. */
export default async function ImportPage() {
  const supabase = await createClient();
  const [accountsRes, rulesRes] = await Promise.all([
    supabase.from("accounts").select("id, name, type").order("name"),
    supabase.from("category_rules").select("keyword, category, priority"),
  ]);

  if (accountsRes.error || rulesRes.error) {
    console.error("Import page query failed", accountsRes.error ?? rulesRes.error);
    throw new Error("Could not load your accounts.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import statement</h1>
        <p className="text-sm text-muted-foreground">
          Upload a Maybank savings statement. Rows you already imported are skipped automatically.
        </p>
      </div>
      <StatementImporter
        initialAccounts={(accountsRes.data ?? []) as AccountOption[]}
        rules={(rulesRes.data ?? []) as CategoryRule[]}
      />
    </div>
  );
}
