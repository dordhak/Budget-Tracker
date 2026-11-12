import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UUID_RE } from "@/lib/import/validate-import";
import { createClient } from "@/lib/supabase/server";
import { suggestKeyword } from "@/lib/transaction-update";
import { cn, formatMYR } from "@/lib/utils";
import { EditTransactionForm } from "./edit-transaction-form";

export const metadata: Metadata = { title: "Expense · Budget Tracker" };

const dayFmt = new Intl.DateTimeFormat("en-MY", {
  weekday: "short",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const stampFmt = new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" });

interface TransactionDetail {
  id: string;
  date: string;
  amount: number | string;
  type: "income" | "expense";
  category: string;
  description: string;
  merchant: string | null;
  notes: string | null;
  balance: number | string | null;
  created_at: string;
  accounts: { name: string } | null;
}

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const [txRes, categoriesRes, rulesRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("id, date, amount, type, category, description, merchant, notes, balance, created_at, accounts(name)")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("transactions").select("category").limit(10_000),
    supabase.from("category_rules").select("category"),
  ]);

  if (txRes.error) {
    console.error("Transaction query failed", txRes.error);
    throw new Error("Could not load this transaction.");
  }
  // RLS hides other users' rows, so "not yours" and "doesn't exist" both land here.
  if (!txRes.data) notFound();

  const tx = txRes.data as unknown as TransactionDetail;
  const categories = [
    ...new Set([...(categoriesRes.data ?? []), ...(rulesRes.data ?? [])].map((r) => r.category as string)),
  ].sort((a, b) => a.localeCompare(b));

  const amount = Number(tx.amount);
  const details: Array<[string, React.ReactNode]> = [
    ["Date", dayFmt.format(new Date(`${tx.date}T00:00:00Z`))],
    ["Type", tx.type === "income" ? "Income" : "Expense"],
    ["Merchant", tx.merchant ?? "—"],
    ["Description", tx.description || "—"],
    ["Account", tx.accounts?.name ?? "—"],
    ["Balance after", tx.balance == null ? "—" : formatMYR(Number(tx.balance))],
    ["Imported", stampFmt.format(new Date(tx.created_at))],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/expenses"
        className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to expenses
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tx.merchant || tx.description || "Transaction"}</h1>
          <p className="text-sm text-muted-foreground">{tx.category}</p>
        </div>
        <p className={cn("text-3xl font-semibold tabular-nums", tx.type === "income" && "text-emerald-700")}>
          {tx.type === "income" ? "+" : "−"}
          {formatMYR(amount)}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
            <CardDescription>From your bank statement.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="grid grid-cols-[7rem_1fr] gap-2">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="break-words">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit</CardTitle>
            <CardDescription>Change the category or add your own notes.</CardDescription>
          </CardHeader>
          <CardContent>
            <EditTransactionForm
              id={tx.id}
              category={tx.category}
              notes={tx.notes}
              suggestedKeyword={suggestKeyword(tx.merchant)}
              categories={categories}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
