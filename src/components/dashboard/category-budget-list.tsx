import { Trash2 } from "lucide-react";
import { deleteCategoryBudget } from "@/app/actions/budgets";
import { Button } from "@/components/ui/button";
import { formatMYR } from "@/lib/utils";

export interface BudgetRow {
  id: string;
  category: string;
  monthly_limit: number;
}

export function CategoryBudgetList({ budgets }: { budgets: BudgetRow[] }) {
  if (budgets.length === 0) {
    return <p className="text-sm text-muted-foreground">No category limits yet. Add one below.</p>;
  }

  return (
    <ul className="divide-y rounded-md border">
      {budgets.map((b) => (
        <li key={b.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
          <span className="truncate">{b.category}</span>
          <span className="flex items-center gap-1">
            <span className="tabular-nums">{formatMYR(b.monthly_limit)}</span>
            <form action={deleteCategoryBudget.bind(null, b.id)}>
              <Button type="submit" variant="ghost" size="icon" aria-label={`Remove ${b.category} budget`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </form>
          </span>
        </li>
      ))}
    </ul>
  );
}
