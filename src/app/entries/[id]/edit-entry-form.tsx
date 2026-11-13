"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_MERCHANT, MAX_NOTES } from "@/lib/entries/validate-entry";
import { cn } from "@/lib/utils";
import { updateEntry, type EntryActionState } from "./actions";

export interface EditableEntry {
  id: string;
  type: "income" | "expense";
  amount: number;
  date: string;
  merchant: string | null;
  category: string;
  payment_method: "bank" | "cash";
  notes: string | null;
  linked: boolean;
}

export function EditEntryForm({ entry, categories, today }: { entry: EditableEntry; categories: string[]; today: string }) {
  const [state, action, pending] = useActionState<EntryActionState, FormData>(updateEntry.bind(null, entry.id), {});
  // Controlled so React 19's post-action form reset never discards typed values.
  const [f, setF] = useState({
    type: entry.type,
    amount: entry.amount.toFixed(2),
    date: entry.date,
    merchant: entry.merchant ?? "",
    category: entry.category,
    payment_method: entry.payment_method,
    notes: entry.notes ?? "",
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const invalid = (field: string) => state.field === field;
  const err = (field: string) => (invalid(field) ? "edit-entry-error" : undefined);

  return (
    <form action={action} className="space-y-5" noValidate>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Type</legend>
        <div className="flex gap-2">
          {(["expense", "income"] as const).map((t) => (
            <label
              key={t}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-4 py-2 text-sm focus-within:ring-2 focus-within:ring-ring",
                f.type === t && "border-primary bg-accent font-medium",
                entry.linked && "cursor-not-allowed opacity-60",
              )}
            >
              <input
                type="radio"
                name="type"
                value={t}
                className="h-4 w-4"
                checked={f.type === t}
                disabled={entry.linked && f.type !== t}
                onChange={() => set("type", t)}
              />
              {t === "expense" ? "Expense" : "Income"}
            </label>
          ))}
        </div>
        {entry.linked && <p className="text-xs text-muted-foreground">Unlink the statement row to change the type.</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount (RM)</Label>
          <Input
            id="amount"
            name="amount"
            inputMode="decimal"
            value={f.amount}
            onChange={(e) => set("amount", e.target.value)}
            aria-invalid={invalid("amount")}
            aria-describedby={err("amount")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            max={today}
            value={f.date}
            onChange={(e) => set("date", e.target.value)}
            aria-invalid={invalid("date")}
            aria-describedby={err("date")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="merchant">{f.type === "income" ? "From" : "Merchant"}</Label>
          <Input
            id="merchant"
            name="merchant"
            maxLength={MAX_MERCHANT}
            value={f.merchant}
            onChange={(e) => set("merchant", e.target.value)}
            aria-invalid={invalid("merchant")}
            aria-describedby={err("merchant")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="category">Category</Label>
          <Input
            id="category"
            name="category"
            list="edit-entry-categories"
            maxLength={60}
            value={f.category}
            onChange={(e) => set("category", e.target.value)}
            aria-invalid={invalid("category")}
            aria-describedby={err("category")}
          />
          <datalist id="edit-entry-categories">
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
              ["bank", "Bank / card / e-wallet"],
              ["cash", "Cash"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                name="payment_method"
                value={value}
                className="h-4 w-4"
                checked={f.payment_method === value}
                disabled={entry.linked && value === "cash"}
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
          value={f.notes}
          onChange={(e) => set("notes", e.target.value)}
          aria-invalid={invalid("notes")}
          aria-describedby={err("notes")}
        />
      </div>

      {state.error && (
        <p id="edit-entry-error" role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
          {state.success}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
