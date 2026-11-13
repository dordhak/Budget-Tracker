import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { MatchBadge } from "@/components/entries/match-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { entryMatchState } from "@/lib/entries/entries-query";
import { daysApart, MANUAL_LINK_WINDOW_DAYS } from "@/lib/entries/match";
import { todayIso } from "@/lib/entries/validate-entry";
import { UUID_RE } from "@/lib/import/validate-import";
import { createClient } from "@/lib/supabase/server";
import { cn, formatMYR } from "@/lib/utils";
import { DeleteEntryButton } from "./delete-entry-button";
import { EditEntryForm } from "./edit-entry-form";
import { LinkPanel, type StatementRow } from "./link-panel";
import { ReceiptPanel } from "./receipt-panel";

export const metadata: Metadata = { title: "Entry · Budget Tracker" };

const SIGNED_URL_SECONDS = 600;
const SOURCE_LABEL = { manual: "Entered by hand", receipt_image: "Receipt photo", receipt_pdf: "PDF receipt" } as const;

const dayFmt = new Intl.DateTimeFormat("en-MY", { weekday: "short", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

interface EntryDetail {
  id: string;
  date: string;
  amount: number | string;
  type: "income" | "expense";
  category: string;
  merchant: string | null;
  notes: string | null;
  payment_method: "bank" | "cash";
  source: keyof typeof SOURCE_LABEL;
  receipt_path: string | null;
  transaction_id: string | null;
}

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function EntryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/entries/${id}`);

  const { data, error } = await supabase
    .from("entries")
    .select("id, date, amount, type, category, merchant, notes, payment_method, source, receipt_path, transaction_id")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("Entry query failed", error);
    throw new Error("Could not load this entry.");
  }
  // RLS hides other users' rows, so "not yours" and "doesn't exist" both land here.
  if (!data) notFound();
  const entry = data as EntryDetail;
  const amount = Number(entry.amount);

  const toRow = (t: Record<string, unknown>): StatementRow => ({
    id: t.id as string,
    date: t.date as string,
    amount: Number(t.amount),
    description: t.description as string,
    merchant: (t.merchant as string | null) ?? null,
    exact: Math.round(Number(t.amount) * 100) === Math.round(amount * 100),
  });

  const [receiptRes, linkedRes, candidateRes, categoriesRes] = await Promise.all([
    entry.receipt_path
      ? supabase.storage.from("receipts").createSignedUrl(entry.receipt_path, SIGNED_URL_SECONDS)
      : Promise.resolve(null),
    entry.transaction_id
      ? supabase.from("transactions").select("id, date, amount, description, merchant").eq("id", entry.transaction_id).maybeSingle()
      : Promise.resolve(null),
    entry.payment_method === "bank" && !entry.transaction_id
      ? supabase
          .from("transactions")
          .select("id, date, amount, description, merchant")
          .eq("type", entry.type)
          .gte("date", shift(entry.date, -MANUAL_LINK_WINDOW_DAYS))
          .lte("date", shift(entry.date, MANUAL_LINK_WINDOW_DAYS))
          .limit(100)
      : Promise.resolve(null),
    supabase.from("category_rules").select("category"),
  ]);

  // Hide statement rows that another entry already claimed.
  let candidates: StatementRow[] = [];
  if (candidateRes?.data?.length) {
    const ids = candidateRes.data.map((t) => t.id as string);
    const { data: taken } = await supabase.from("entries").select("transaction_id").in("transaction_id", ids);
    const takenIds = new Set((taken ?? []).map((t) => t.transaction_id as string));
    candidates = candidateRes.data
      .filter((t) => !takenIds.has(t.id as string))
      .map(toRow)
      .sort(
        (a, b) =>
          Number(b.exact) - Number(a.exact) ||
          daysApart(a.date, entry.date) - daysApart(b.date, entry.date) ||
          a.date.localeCompare(b.date),
      )
      .slice(0, 15);
  }

  const receiptUrl = receiptRes && "data" in receiptRes ? (receiptRes.data?.signedUrl ?? null) : null;
  const receiptKind = entry.receipt_path ? (entry.receipt_path.endsWith(".pdf") ? "pdf" : "image") : null;
  const linked = linkedRes?.data ? toRow(linkedRes.data) : null;
  const categories = [...new Set((categoriesRes.data ?? []).map((r) => r.category as string))].sort();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/entries"
        className="inline-flex items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to entries
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{entry.merchant || entry.category}</h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {dayFmt.format(new Date(`${entry.date}T00:00:00Z`))} · {entry.category} · {SOURCE_LABEL[entry.source]}
            <MatchBadge state={entryMatchState(entry)} />
          </p>
        </div>
        <p className={cn("text-3xl font-semibold tabular-nums", entry.type === "income" && "text-emerald-700 dark:text-emerald-300")}>
          {entry.type === "income" ? "+" : "−"}
          {formatMYR(amount)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Edit</CardTitle>
          </CardHeader>
          <CardContent>
            <EditEntryForm
              entry={{
                id: entry.id,
                type: entry.type,
                amount,
                date: entry.date,
                merchant: entry.merchant,
                category: entry.category,
                payment_method: entry.payment_method,
                notes: entry.notes,
                linked: Boolean(entry.transaction_id),
              }}
              categories={categories}
              today={todayIso()}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Receipt</CardTitle>
              <CardDescription>Stored privately; links expire after 10 minutes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ReceiptPanel entryId={entry.id} userId={user.id} url={receiptUrl} kind={receiptKind} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bank statement</CardTitle>
            </CardHeader>
            <CardContent>
              <LinkPanel entryId={entry.id} paymentMethod={entry.payment_method} linked={linked} candidates={candidates} />
            </CardContent>
          </Card>

          <DeleteEntryButton entryId={entry.id} hasReceipt={Boolean(entry.receipt_path)} />
        </div>
      </div>
    </div>
  );
}
