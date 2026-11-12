"use client";

import { ExternalLink, FileText, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { MAX_RECEIPT_BYTES, readReceipt } from "@/lib/receipt/read-receipt";
import { createClient } from "@/lib/supabase/client";
import { attachReceipt, removeReceipt } from "./actions";

interface Props {
  entryId: string;
  userId: string;
  /** Short-lived signed URL for the stored receipt, created on the server. */
  url: string | null;
  kind: "image" | "pdf" | null;
}

export function ReceiptPanel({ entryId, userId, url, kind }: Props) {
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [isPending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    if (file.size > MAX_RECEIPT_BYTES) return setError("That file is larger than 10 MB.");
    try {
      setProgress(0);
      // Reuses the reader for the privacy-friendly stored copy (downscaled, metadata removed).
      const r = await readReceipt(file, (_s, p) => setProgress(Math.round(p * 100)), { ocr: false });
      setProgress(null);
      startTransition(async () => {
        const supabase = createClient();
        const path = `${userId}/${crypto.randomUUID()}.${r.storeContentType === "application/pdf" ? "pdf" : "jpg"}`;
        const up = await supabase.storage.from("receipts").upload(path, r.storeBlob, { contentType: r.storeContentType });
        if (up.error) return setError("Could not upload the receipt.");
        const res = await attachReceipt(entryId, path, r.source);
        if (!res.ok) {
          await supabase.storage.from("receipts").remove([path]);
          setError(res.error);
        }
      });
    } catch (err) {
      setProgress(null);
      setError(err instanceof Error ? err.message : "Could not read that file.");
    }
  }

  return (
    <div className="space-y-3">
      {url && kind === "image" && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived storage URL */}
          <img src={url} alt="Stored receipt" className="max-h-96 w-full rounded-md border object-contain" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
      {url && kind === "pdf" && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Open PDF receipt
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
      {!url && <p className="text-sm text-muted-foreground">No receipt attached.</p>}

      {progress !== null && <Progress value={progress} aria-label="Reading receipt" className="max-w-xs" />}

      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/*,application/pdf" className="sr-only" tabIndex={-1} onChange={onFile} aria-hidden="true" />
        <Button type="button" variant="outline" size="sm" disabled={isPending || progress !== null} onClick={() => input.current?.click()}>
          <Upload className="h-4 w-4" aria-hidden="true" />
          {url ? "Replace receipt" : "Attach receipt"}
        </Button>
        {url &&
          (confirmRemove ? (
            <>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await removeReceipt(entryId);
                    if (!res.ok) setError(res.error);
                    setConfirmRemove(false);
                  })
                }
              >
                Confirm remove
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRemove(false)}>
                Cancel
              </Button>
            </>
          ) : (
            <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmRemove(true)}>
              Remove receipt
            </Button>
          ))}
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
