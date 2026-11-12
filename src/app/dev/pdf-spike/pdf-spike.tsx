"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { detectParser, formatCents, type ParsedStatement } from "@/lib/import";
import { extractPositionedText, type PositionedText } from "@/lib/pdf/extract-text";
import { cn } from "@/lib/utils";

export function PdfSpike() {
  const [items, setItems] = useState<PositionedText[]>([]);
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [view, setView] = useState<"parsed" | "raw">("parsed");

  const pageCount = useMemo(() => items.reduce((max, i) => Math.max(max, i.page), 0), [items]);
  const pageItems = useMemo(
    () => items.filter((i) => i.page === page).sort((a, b) => b.y - a.y || a.x - b.x),
    [items, page],
  );

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setStatus("Reading…");
    setParsed(null);
    try {
      const result = await extractPositionedText(await file.arrayBuffer());
      setItems(result);
      setPage(1);
      const parser = detectParser(result);
      if (!parser) {
        setStatus(`Extracted ${result.length} text items, but this doesn't look like a Maybank savings statement.`);
        setView("raw");
        return;
      }
      const statement = parser.parse(result);
      console.log("[pdf-spike] parsed statement", statement);
      setParsed(statement);
      setView("parsed");
      setStatus(`Extracted ${result.length} text items. ${parser.label}: ${statement.transactions.length} transactions.`);
    } catch (err) {
      console.error(err);
      setStatus(`Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full max-w-sm space-y-2">
          <Label htmlFor="pdf">Statement PDF</Label>
          <Input id="pdf" type="file" accept="application/pdf" onChange={onChange} />
        </div>
        {pageCount > 0 && (
          <div className="w-40 space-y-2">
            <Label htmlFor="view">View</Label>
            <Select id="view" value={view} onChange={(e) => setView(e.target.value as "parsed" | "raw")}>
              <option value="parsed" disabled={!parsed}>
                Parsed rows
              </option>
              <option value="raw">Raw text items</option>
            </Select>
          </div>
        )}
        {view === "raw" && pageCount > 0 && (
          <div className="w-32 space-y-2">
            <Label htmlFor="page">Page</Label>
            <Select id="page" value={page} onChange={(e) => setPage(Number(e.target.value))}>
              {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <p role="status" className="text-sm">
        {status}
      </p>

      {view === "parsed" && parsed && <ParsedView statement={parsed} />}

      {view === "raw" && pageItems.length > 0 && (
        <pre className="max-h-[60vh] overflow-auto rounded-md bg-muted p-3 text-xs">
          {pageItems.map((i) => `p${i.page} x=${i.x.toFixed(1)} y=${i.y.toFixed(1)}  ${i.str}`).join("\n")}
        </pre>
      )}
    </div>
  );
}

function ParsedView({ statement }: { statement: ParsedStatement }) {
  const flagged = statement.transactions.filter((t) => t.flags.length > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <p>Statement date: {statement.statementDate ?? "—"}</p>
        <p>Opening: RM {formatCents(statement.openingBalanceCents)}</p>
        <p>Closing: RM {formatCents(statement.closingBalanceCents)}</p>
        <p>Needs review: {flagged}</p>
      </div>

      <ul className="space-y-1 text-sm" aria-label="Checksums">
        {statement.checks.map((c) => (
          <li key={c.id} className={cn(c.ok === false && "font-medium text-destructive", c.ok && "text-emerald-700")}>
            {c.ok === null ? "?" : c.ok ? "✓" : "✗"} {c.label}: expected {formatCents(c.expectedCents)}, got{" "}
            {formatCents(c.actualCents)}
          </li>
        ))}
      </ul>

      {statement.warnings.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-sm text-amber-700" aria-label="Warnings">
          {statement.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Merchant</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Balance</TableHead>
            <TableHead>Flags</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {statement.transactions.map((t) => (
            <TableRow key={t.index} className={cn(t.flags.length > 0 && "bg-amber-50")}>
              <TableCell className="text-muted-foreground">
                {t.index + 1} <span className="text-xs">p{t.page}</span>
              </TableCell>
              <TableCell className="whitespace-nowrap">{t.date}</TableCell>
              <TableCell className="max-w-md text-xs">{t.description}</TableCell>
              <TableCell className="text-xs">{t.merchant ?? "—"}</TableCell>
              <TableCell
                className={cn("whitespace-nowrap text-right tabular-nums", t.type === "income" && "text-emerald-700")}
              >
                {t.type === "income" ? "+" : "−"}
                {formatCents(t.amountCents)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">{formatCents(t.balanceCents)}</TableCell>
              <TableCell className="text-xs">{t.flags.join(", ")}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
