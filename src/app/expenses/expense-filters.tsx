"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { expensesHref, type ExpenseParams } from "@/lib/expenses-query";

const DEBOUNCE_MS = 300;

/**
 * Client Component: owns only the input state and pushes it into the URL.
 * The server page re-renders from searchParams, so results stay shareable/bookmarkable.
 */
export function ExpenseFilters({ params, categories }: { params: ExpenseParams; categories: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(params.q);
  const lastPushed = useRef(params.q);

  // Keep the box in sync when the URL changes elsewhere (back button, "clear filters").
  useEffect(() => {
    setQ(params.q);
    lastPushed.current = params.q;
  }, [params.q]);

  useEffect(() => {
    if (q.trim() === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = q.trim();
      startTransition(() => router.replace(expensesHref(params, { q: q.trim() }), { scroll: false }));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, params, router]);

  return (
    <form
      role="search"
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        lastPushed.current = q.trim();
        startTransition(() => router.replace(expensesHref(params, { q: q.trim() }), { scroll: false }));
      }}
    >
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="expense-search">Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="expense-search"
            type="search"
            value={q}
            maxLength={100}
            placeholder="Merchant or description, e.g. grab"
            className="pl-9"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5 sm:w-56">
        <Label htmlFor="expense-category">Category</Label>
        <Select
          id="expense-category"
          value={params.category}
          onChange={(e) =>
            startTransition(() => router.replace(expensesHref(params, { category: e.target.value }), { scroll: false }))
          }
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
      </div>

      <span role="status" aria-live="polite" className="flex h-10 w-6 items-center">
        {isPending && (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Updating results…</span>
          </>
        )}
      </span>
    </form>
  );
}
