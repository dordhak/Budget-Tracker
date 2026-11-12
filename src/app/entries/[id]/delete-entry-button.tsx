"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteEntry } from "./actions";

/** Two-step delete; the action redirects to /entries on success. */
export function DeleteEntryButton({ entryId, hasReceipt }: { entryId: string; hasReceipt: boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  if (!confirming) {
    return (
      <Button type="button" variant="outline" onClick={() => setConfirming(true)}>
        Delete entry
      </Button>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-destructive/40 p-3" role="group" aria-label="Confirm delete">
      <p className="text-sm">
        Delete this entry{hasReceipt ? " and its stored receipt" : ""}? This can&apos;t be undone. Statement rows are not
        affected.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          autoFocus
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const res = await deleteEntry(entryId);
              if (res && !res.ok) setError(res.error);
            })
          }
        >
          {isPending ? "Deleting…" : "Delete"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)} disabled={isPending}>
          Cancel
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
