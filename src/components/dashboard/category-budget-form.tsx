"use client";

import { useActionState } from "react";
import { upsertCategoryBudget, type FormState } from "@/app/actions/budgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Add a category budget, or update the limit of an existing one (same name). */
export function CategoryBudgetForm({ suggestions }: { suggestions: string[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(upsertCategoryBudget, {});

  return (
    <form action={action} className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="category">Category</Label>
          <Input id="category" name="category" list="category-suggestions" maxLength={60} required placeholder="e.g. Food" />
          <datalist id="category-suggestions">
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="monthly_limit">Monthly limit (RM)</Label>
          <Input id="monthly_limit" name="monthly_limit" inputMode="decimal" required placeholder="500" />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="text-sm text-destructive">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="text-sm text-emerald-700">
        {state.success}
      </p>
    );
  }
  return null;
}
