"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatCents } from "@/lib/import";
import { parseReceiptText, type ReceiptSuggestion } from "@/lib/receipt/parse-receipt";
import { readReceipt, type ReadReceiptResult } from "@/lib/receipt/read-receipt";

export function ReceiptSpike() {
  const [status, setStatus] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<ReadReceiptResult | null>(null);
  const [suggestion, setSuggestion] = useState<ReceiptSuggestion | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ms, setMs] = useState<number | null>(null);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setSuggestion(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file.type.startsWith("image/") ? URL.createObjectURL(file) : null);
    setStatus("Reading…");
    const started = performance.now();
    try {
      const r = await readReceipt(file, (s, p) => {
        setStatus(s);
        setProgress(Math.round(p * 100));
      });
      setResult(r);
      setSuggestion(parseReceiptText(r.text));
      setMs(Math.round(performance.now() - started));
      setStatus("Done.");
    } catch (err) {
      console.error(err);
      setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="max-w-sm space-y-2">
        <Label htmlFor="receipt">Receipt</Label>
        <Input id="receipt" type="file" accept="image/*,application/pdf" onChange={onChange} />
      </div>
      <p role="status" className="text-sm">
        {status}
      </p>
      {progress !== null && <Progress value={progress} aria-label="Recognition progress" className="max-w-sm" />}

      {result && suggestion && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-2 text-sm">
            <p>
              Method: {result.method} {result.confidence !== null && `(confidence ${result.confidence}%)`} · {ms} ms ·
              stored as {result.storeContentType}, {Math.round(result.storeBlob.size / 1024)} KB
            </p>
            <dl className="grid grid-cols-[8rem_1fr] gap-1">
              <dt className="text-muted-foreground">Amount</dt>
              <dd>
                {suggestion.amountCents === null ? "—" : `RM ${formatCents(suggestion.amountCents)}`} (
                {suggestion.amountConfidence})
              </dd>
              <dt className="text-muted-foreground">Date</dt>
              <dd>{suggestion.date ?? "—"}</dd>
              <dt className="text-muted-foreground">Merchant</dt>
              <dd>{suggestion.merchant ?? "—"}</dd>
              <dt className="text-muted-foreground">Type</dt>
              <dd>{suggestion.type}</dd>
            </dl>
            <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">
              {result.text}
            </pre>
          </div>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview
            <img src={preview} alt="Selected receipt" className="max-h-[70vh] rounded-md border object-contain" />
          )}
        </div>
      )}
    </div>
  );
}
