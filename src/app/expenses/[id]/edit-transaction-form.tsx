"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_NOTES } from "@/lib/transaction-update";
import { updateTransaction, type EditState } from "./actions";

interface Props {
  id: string;
  category: string;
  notes: string | null;
  suggestedKeyword: string;
  categories: string[];
}

export function EditTransactionForm({ id, category, notes, suggestedKeyword, categories }: Props) {
  const [state, action, pending] = useActionState<EditState, FormData>(updateTransaction.bind(null, id), {});
  // Controlled so React 19's automatic form reset after an action never wipes what was typed.
  const [categoryValue, setCategoryValue] = useState(category);
  const [notesValue, setNotesValue] = useState(notes ?? "");
  const [keyword, setKeyword] = useState(suggestedKeyword);
  const [saveRule, setSaveRule] = useState(false);

  const invalid = (field: string) => state.field === field;
  const describedBy = (field: string, hint?: string) =>
    [hint, invalid(field) ? "edit-error" : undefined].filter(Boolean).join(" ") || undefined;

  return (
    <form action={action} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="category">Category</Label>
        <Input
          id="category"
          name="category"
          list="category-options"
          value={categoryValue}
          onChange={(e) => setCategoryValue(e.target.value)}
          maxLength={60}
          required
          aria-invalid={invalid("category")}
          aria-describedby={describedBy("category")}
        />
        <datalist id="category-options">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Personal notes</Label>
        <Textarea
          id="notes"
          name="notes"
          rows={4}
          value={notesValue}
          maxLength={MAX_NOTES}
          placeholder="e.g. Team lunch, split with a friend"
          onChange={(e) => setNotesValue(e.target.value)}
          aria-invalid={invalid("notes")}
          aria-describedby={describedBy("notes", "notes-count")}
        />
        <p id="notes-count" className="text-right text-xs text-muted-foreground">
          {notesValue.length}/{MAX_NOTES}
        </p>
      </div>

      <fieldset className="space-y-3 rounded-md border p-4">
        <legend className="px-1 text-sm font-medium">Future imports</legend>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            name="save_rule"
            className="mt-0.5 h-4 w-4"
            checked={saveRule}
            onChange={(e) => setSaveRule(e.target.checked)}
          />
          <span>Use this category for future transactions whose merchant or description contains:</span>
        </label>
        <div className="space-y-2 pl-6">
          <Label htmlFor="keyword" className="sr-only">
            Keyword
          </Label>
          <Input
            id="keyword"
            name="keyword"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            maxLength={100}
            disabled={!saveRule}
            aria-invalid={invalid("keyword")}
            aria-describedby={describedBy("keyword", "keyword-hint")}
          />
          <p id="keyword-hint" className="text-xs text-muted-foreground">
            Matching ignores upper/lower case. Existing transactions are not changed.
          </p>
        </div>
      </fieldset>

      {state.error && (
        <p id="edit-error" role="alert" className="text-sm font-medium text-destructive">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-700">
          {state.success}
        </p>
      )}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
