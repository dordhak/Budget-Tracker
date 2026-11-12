"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { entriesHref, type EntryParams } from "@/lib/entries/entries-query";

const DEBOUNCE_MS = 300;

/** Client Component: only pushes filter state into the URL; the server page does the querying. */
export function EntryFilters({ params }: { params: EntryParams }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(params.q);
  const lastPushed = useRef(params.q);

  useEffect(() => {
    setQ(params.q);
    lastPushed.current = params.q;
  }, [params.q]);

  const go = (changes: Partial<EntryParams>) =>
    startTransition(() => router.replace(entriesHref(params, changes), { scroll: false }));

  useEffect(() => {
    if (q.trim() === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = q.trim();
      go({ q: q.trim() });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `go` is recreated each render
  }, [q, params]);

  return (
    <form
      role="search"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_11rem_9rem_12rem_1.5rem] lg:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        lastPushed.current = q.trim();
        go({ q: q.trim() });
      }}
    >
      <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
        <Label htmlFor="entry-search">Search</Label>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="entry-search"
            type="search"
            value={q}
            maxLength={100}
            placeholder="Merchant, category or note"
            className="pl-9"
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entry-month">Month</Label>
        <Input id="entry-month" type="month" value={params.month} onChange={(e) => go({ month: e.target.value })} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entry-type">Type</Label>
        <Select
          id="entry-type"
          value={params.type}
          onChange={(e) => go({ type: e.target.value as EntryParams["type"] })}
        >
          <option value="">All</option>
          <option value="expense">Expenses</option>
          <option value="income">Income</option>
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="entry-status">Status</Label>
        <Select
          id="entry-status"
          value={params.status}
          onChange={(e) => go({ status: e.target.value as EntryParams["status"] })}
        >
          <option value="">Any status</option>
          <option value="awaiting">Awaiting statement</option>
          <option value="matched">Matched to statement</option>
          <option value="cash">Cash</option>
        </Select>
      </div>

      <span role="status" aria-live="polite" className="flex h-10 items-center">
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
