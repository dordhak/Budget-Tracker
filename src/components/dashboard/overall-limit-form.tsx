"use client";

import { useActionState } from "react";
import { setOverallLimit, type FormState } from "@/app/actions/budgets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormMessage } from "./category-budget-form";

export function OverallLimitForm({ current }: { current: number | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(setOverallLimit, {});

  return (
    <form action={action} className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="overall_monthly_limit">Overall monthly limit (RM)</Label>
          <Input
            id="overall_monthly_limit"
            name="overall_monthly_limit"
            inputMode="decimal"
            placeholder="Leave empty for no limit"
            defaultValue={current ?? ""}
            aria-describedby="overall-hint"
          />
        </div>
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </div>
      <p id="overall-hint" className="text-xs text-muted-foreground">
        One cap for all spending this month, separate from the category limits.
      </p>
      <FormMessage state={state} />
    </form>
  );
}
