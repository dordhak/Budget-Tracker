"use client";

import { Camera, FileText, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { categorize, type CategoryRule } from "@/lib/import";
import { MAX_MERCHANT, MAX_NOTES, type EntrySource } from "@/lib/entries/validate-entry";
import { parseReceiptText } from "@/lib/receipt/parse-receipt";
import { MAX_RECEIPT_BYTES, readReceipt } from "@/lib/receipt/read-receipt";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { createEntry, type EntryFormState } from "../actions";

interface Props {
  userId: string;
  today: string;
  rules: CategoryRule[];
  categories: string[];
}

interface Fields {
  type: "income" | "expense";
  amount: string;
  date: string;
  merchant: string;
  category: string;
  payment_method: "bank" | "cash";
  notes: string;
}

interface Receipt {
  file: File;
  previewUrl: string | null;
  blob: Blob;
  contentType: "image/jpeg" | "application/pdf";
  source: Exclude<EntrySource, "manual">;
}

const blank = (today: string): Fields => ({
  type: "expense",
  amount: "",
  date: today,
  merchant: "",
  category: "",
  payment_method: "bank",
  notes: "",
});

export function EntryForm({ userId, today, rules, categories }: Props) {
  const [fields, setFields] = useState<Fields>(blank(today));
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [keepReceipt, setKeepReceipt] = useState(true);
  const [ocr, setOcr] = useState<{ status: string; progress: number } | null>(null);
  const [prefill, setPrefill] = useState<{ lowConfidence: boolean; confidence: number | null } | null>(null);
  const [state, setState] = useState<EntryFormState>({});
  const [isPending, startTransition] = useTransition();
  const fileInput = useRef<HTMLInputElement>(null);
  const amountInput = useRef<HTMLInputElement>(null);

  // Free object URLs when the receipt changes or the form unmounts.
  useEffect(() => () => void (receipt?.previewUrl && URL.revokeObjectURL(receipt.previewUrl)), [receipt]);

  const set = <K extends keyof Fields>(key: K, value: Fields[K]) => setFields((f) => ({ ...f, [key]: value }));
  const invalid = (field: string) => state.field === field;
  const errorFor = (field: string) => (invalid(field) ? "entry-error" : undefined);

  async function onReceipt(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow choosing the same file again
    if (!file) return;
    setState({});
    if (file.size > MAX_RECEIPT_BYTES) return setState({ error: "That file is larger than 10 MB.", field: "receipt" });

    setOcr({ status: "Starting…", progress: 0 });
    try {
      const result = await readReceipt(file, (status, progress) => setOcr({ status, progress }));
      const s = parseReceiptText(result.text);
      const firstLines = result.text.split("\n").slice(0, 8).join(" ");
      setReceipt({
        file,
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : null,
        blob: result.storeBlob,
        contentType: result.storeContentType,
        source: result.source,
      });
      // Only fill what was found; keep anything the receipt didn't reveal.
      setFields((f) => ({
        ...f,
        type: s.type,
        amount: s.amountCents !== null ? (s.amountCents / 100).toFixed(2) : f.amount,
        date: s.date ?? f.date,
        merchant: s.merchant ?? f.merchant,
        category: f.category || categorize({ merchant: s.merchant, description: firstLines }, rules),
      }));
      setPrefill({ lowConfidence: s.amountCents === null || s.amountConfidence === "low", confidence: result.confidence });
      requestAnimationFrame(() => amountInput.current?.focus());
    } catch (err) {
      setState({ error: err instanceof Error ? err.message : "Could not read that receipt.", field: "receipt" });
    } finally {
      setOcr(null);
    }
  }

  function clearReceipt() {
    setReceipt(null);
    setPrefill(null);
  }

  function reset() {
    setFields(blank(today));
    clearReceipt();
    setKeepReceipt(true);
    setState({});
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setState({});

    startTransition(async () => {
      const supabase = createClient();
      let uploadedPath: string | null = null;

      if (receipt) formData.set("source", receipt.source);
      if (receipt && keepReceipt) {
        const ext = receipt.contentType === "application/pdf" ? "pdf" : "jpg";
        uploadedPath = `${userId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("receipts")
          .upload(uploadedPath, receipt.blob, { contentType: receipt.contentType, upsert: false });
        if (error) {
          setState({ error: "Could not upload the receipt. Try again, or untick “Keep receipt”.", field: "receipt" });
          return;
        }
        formData.set("receipt_path", uploadedPath);
      }

      const result = await createEntry({}, formData);
      if (result.error && uploadedPath) {
        // Don't leave an orphaned file behind.
        await supabase.storage.from("receipts").remove([uploadedPath]);
      }
      setState(result);
    });
  }

  if (state.savedId) {
    return (
      <Card>
        <CardContent className="space-y-4 pt-6">
          <p role="status" className="font-medium text-emerald-700 dark:text-emerald-300">
            Saved {fields.type === "income" ? "income" : "expense"} of RM {Number(fields.amount).toFixed(2)}
            {fields.merchant && ` (${fields.merchant})`}.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={reset} autoFocus>
              Add another
            </Button>
            <Button asChild variant="outline">
              <Link href={`/entries/${state.savedId}`}>View entry</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="/">Budget dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" noValidate>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Receipt (optional)</CardTitle>
          <CardDescription>
            A photo, screenshot or PDF. It&apos;s read in your browser to pre-fill the form; check the details before
            saving.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!receipt && !ocr && (
            <div>
              <input
                ref={fileInput}
                id="receipt"
                type="file"
                accept="image/*,application/pdf"
                className="sr-only"
                onChange={onReceipt}
                aria-describedby={errorFor("receipt")}
              />
              <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}>
                <Camera className="h-4 w-4" aria-hidden="true" />
                Add receipt
              </Button>
              <Label htmlFor="receipt" className="sr-only">
                Receipt file
              </Label>
            </div>
          )}

          {ocr && (
            <div className="max-w-sm space-y-2" role="status">
              <p className="text-sm text-muted-foreground">Reading receipt: {ocr.status}…</p>
              <Progress value={Math.round(ocr.progress * 100)} aria-label="Receipt reading progress" />
            </div>
          )}

          {receipt && (
            <div className="flex flex-wrap items-start gap-4">
              {receipt.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local blob preview
                <img
                  src={receipt.previewUrl}
                  alt="Receipt preview"
                  className="max-h-56 rounded-md border object-contain"
                />
              ) : (
                <p className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                  {receipt.file.name}
                </p>
              )}
              <div className="space-y-3">
                {prefill && (
                  <p className={cn("text-sm", prefill.lowConfidence ? "text-amber-800 dark:text-amber-300" : "text-muted-foreground")}>
                    {prefill.lowConfidence
                      ? "Couldn't find a clear total. Please check the amount."
                      : "Pre-filled from the receipt. Please check the details."}
                    {prefill.confidence !== null && ` (text recognition confidence ${prefill.confidence}%)`}
                  </p>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={keepReceipt}
                    onChange={(e) => setKeepReceipt(e.target.checked)}
                  />
                  Keep receipt with this entry (stored privately)
                </label>
                <Button type="button" variant="ghost" size="sm" onClick={clearReceipt}>
                  <X className="h-4 w-4" aria-hidden="true" />
                  Remove receipt
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Type</legend>
            <div className="flex gap-2">
              {(["expense", "income"] as const).map((t) => (
                <label
                  key={t}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm focus-within:ring-2 focus-within:ring-ring",
                    fields.type === t && "border-primary bg-accent font-medium",
                  )}
                >
                  <input
                    type="radio"
                    name="type"
                    value={t}
                    className="h-4 w-4"
                    checked={fields.type === t}
                    onChange={() => set("type", t)}
                  />
                  {t === "expense" ? "Expense" : "Income"}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (RM)</Label>
              <Input
                ref={amountInput}
                id="amount"
                name="amount"
                inputMode="decimal"
                autoComplete="off"
                required
                placeholder="0.00"
                value={fields.amount}
                onChange={(e) => set("amount", e.target.value)}
                aria-invalid={invalid("amount")}
                aria-describedby={errorFor("amount")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                max={today}
                value={fields.date}
                onChange={(e) => set("date", e.target.value)}
                aria-invalid={invalid("date")}
                aria-describedby={errorFor("date")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="merchant">{fields.type === "income" ? "From" : "Merchant"}</Label>
              <Input
                id="merchant"
                name="merchant"
                maxLength={MAX_MERCHANT}
                placeholder={fields.type === "income" ? "e.g. Employer" : "e.g. 99 Speedmart"}
                value={fields.merchant}
                onChange={(e) => set("merchant", e.target.value)}
                onBlur={() => {
                  // Suggest a category from your keyword rules if none was chosen yet.
                  if (!fields.category && fields.merchant) {
                    const c = categorize({ merchant: fields.merchant, description: "" }, rules);
                    if (c !== "Uncategorized") set("category", c);
                  }
                }}
                aria-invalid={invalid("merchant")}
                aria-describedby={errorFor("merchant")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Input
                id="category"
                name="category"
                list="entry-categories"
                maxLength={60}
                placeholder="Uncategorized"
                value={fields.category}
                onChange={(e) => set("category", e.target.value)}
                aria-invalid={invalid("category")}
                aria-describedby={errorFor("category")}
              />
              <datalist id="entry-categories">
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Paid with</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(
                [
                  ["bank", "Bank / card / e-wallet (will appear on a statement)"],
                  ["cash", "Cash"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="payment_method"
                    value={value}
                    className="h-4 w-4"
                    checked={fields.payment_method === value}
                    onChange={() => set("payment_method", value)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              rows={3}
              maxLength={MAX_NOTES}
              value={fields.notes}
              onChange={(e) => set("notes", e.target.value)}
              aria-invalid={invalid("notes")}
              aria-describedby={errorFor("notes")}
            />
          </div>

          {state.error && (
            <p id="entry-error" role="alert" className="text-sm font-medium text-destructive">
              {state.error}
            </p>
          )}

          <Button type="submit" disabled={isPending || Boolean(ocr)}>
            {isPending ? "Saving…" : `Save ${fields.type}`}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
