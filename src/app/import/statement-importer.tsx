"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  categorize,
  computeDedupeKeys,
  detectParser,
  formatCents,
  type CategoryRule,
  type ParsedStatement,
  type ReviewFlag,
} from "@/lib/import";
import { extractPositionedText } from "@/lib/pdf/extract-text";
import { cn } from "@/lib/utils";
import { createAccount, findExistingKeys, importTransactions, type AccountOption } from "./actions";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const INSERT_CHUNK = 200;
const NEW_ACCOUNT = "__new__";

const FLAG_LABELS: Record<ReviewFlag, string> = {
  description_reconstructed: "Description re-assembled",
  description_unaligned: "Description uncertain",
  sign_mismatch: "Sign disagrees with balance",
  balance_mismatch: "Amount doesn't match balance",
  missing_balance: "No balance",
  date_inferred: "Year inferred",
  date_out_of_range: "Date outside statement period",
};

interface Parsed {
  fileName: string;
  statement: ParsedStatement;
  categories: string[];
}

interface Check {
  accountId: string;
  keys: string[];
  existing: Set<string>;
}

type ImportOutcome = { inserted: number; skipped: number };

export function StatementImporter({
  initialAccounts,
  rules,
}: {
  initialAccounts: AccountOption[];
  rules: CategoryRule[];
}) {
  const [accounts, setAccounts] = useState(initialAccounts);
  const [accountId, setAccountId] = useState(initialAccounts.length === 1 ? initialAccounts[0].id : "");
  const [newAccountName, setNewAccountName] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [excluded, setExcluded] = useState<Set<number>>(new Set());
  const [acknowledged, setAcknowledged] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<ImportOutcome | null>(null);
  const [isPending, startTransition] = useTransition();

  // Keys depend on the account, so (re)compute them and look up duplicates whenever either changes.
  useEffect(() => {
    if (!parsed || !accountId || accountId === NEW_ACCOUNT) {
      setCheck(null);
      return;
    }
    let cancelled = false;
    setStatus("Checking for transactions you've already imported…");
    (async () => {
      const keys = await computeDedupeKeys(parsed.statement.transactions, accountId);
      const res = await findExistingKeys(keys);
      if (cancelled) return;
      if (!res.ok) {
        setError(res.error);
        setStatus("");
        return;
      }
      const existing = new Set(res.data);
      setCheck({ accountId, keys, existing });
      setExcluded(new Set());
      setStatus("");
    })().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Duplicate check failed.");
    });
    return () => {
      cancelled = true;
    };
  }, [parsed, accountId]);

  const rows = useMemo(() => {
    if (!parsed || !check) return [];
    return parsed.statement.transactions.map((t, i) => {
      const duplicate = check.existing.has(check.keys[i]);
      return { t, key: check.keys[i], category: parsed.categories[i], duplicate, selected: !duplicate && !excluded.has(i) };
    });
  }, [parsed, check, excluded]);

  const counts = useMemo(
    () => ({
      selected: rows.filter((r) => r.selected).length,
      duplicates: rows.filter((r) => r.duplicate).length,
      flagged: rows.filter((r) => r.t.flags.length > 0).length,
    }),
    [rows],
  );

  const failedChecks = parsed?.statement.checks.filter((c) => c.ok === false) ?? [];
  const canImport = counts.selected > 0 && (failedChecks.length === 0 || acknowledged) && !isPending && !outcome;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setParsed(null);
    setOutcome(null);
    setError("");
    setAcknowledged(false);
    if (!file) return;
    if (file.type && file.type !== "application/pdf") return setError("Please choose a PDF file.");
    if (file.size > MAX_FILE_BYTES) return setError("That file is larger than 20 MB.");

    setStatus("Reading the PDF in your browser…");
    try {
      const items = await extractPositionedText(await file.arrayBuffer());
      const parser = detectParser(items);
      if (!parser) {
        setStatus("");
        return setError("This doesn't look like a Maybank savings statement. Only those are supported for now.");
      }
      const statement = parser.parse(items);
      if (statement.transactions.length === 0) {
        setStatus("");
        return setError("No transactions were found in this statement.");
      }
      setParsed({ fileName: file.name, statement, categories: statement.transactions.map((t) => categorize(t, rules)) });
      setStatus("");
    } catch (err) {
      console.error(err);
      setStatus("");
      setError("Could not read this PDF. If it's password-protected, save an unprotected copy and try again.");
    }
  }

  function onCreateAccount() {
    setError("");
    startTransition(async () => {
      const res = await createAccount(newAccountName);
      if (!res.ok) return setError(res.error);
      setAccounts((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)));
      setAccountId(res.data.id);
      setNewAccountName("");
    });
  }

  function toggle(index: number) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function onImport() {
    if (!check) return;
    const payload = rows
      .filter((r) => r.selected)
      .map((r) => ({
        date: r.t.date,
        amount: r.t.amount,
        type: r.t.type,
        category: r.category,
        description: r.t.description,
        merchant: r.t.merchant,
        balance: r.t.balance,
        dedupe_key: r.key,
      }));

    setError("");
    startTransition(async () => {
      const total: ImportOutcome = { inserted: 0, skipped: 0 };
      for (let i = 0; i < payload.length; i += INSERT_CHUNK) {
        setStatus(`Saving ${Math.min(i + INSERT_CHUNK, payload.length)} of ${payload.length}…`);
        const res = await importTransactions(check.accountId, payload.slice(i, i + INSERT_CHUNK));
        if (!res.ok) {
          setStatus("");
          setError(
            total.inserted > 0
              ? `${res.error} ${total.inserted} rows were saved before this; importing again will skip them.`
              : res.error,
          );
          if (total.inserted > 0) setOutcome(total);
          return;
        }
        total.inserted += res.data.inserted;
        total.skipped += res.data.skipped;
      }
      setStatus("");
      setOutcome(total);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Choose a statement</CardTitle>
          <CardDescription>
            Maybank savings statement (PDF). It is read in your browser; only the parsed rows are saved.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="statement">Statement PDF</Label>
          <Input id="statement" type="file" accept="application/pdf" onChange={onFile} disabled={isPending} />
        </CardContent>
      </Card>

      {parsed && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Choose the account</CardTitle>
            <CardDescription>Duplicates are detected per account.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="max-w-sm space-y-2">
              <Label htmlFor="account">Account</Label>
              <Select
                id="account"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                disabled={isPending || Boolean(outcome)}
              >
                <option value="" disabled>
                  Select an account…
                </option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value={NEW_ACCOUNT}>+ New savings account…</option>
              </Select>
            </div>
            {accountId === NEW_ACCOUNT && (
              <div className="flex max-w-sm items-end gap-2">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="new-account">New account name</Label>
                  <Input
                    id="new-account"
                    value={newAccountName}
                    maxLength={100}
                    placeholder="e.g. Maybank Savings"
                    onChange={(e) => setNewAccountName(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={onCreateAccount} disabled={isPending || !newAccountName.trim()}>
                  Create
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {(status || error) && (
        <div className="space-y-1">
          {status && (
            <p role="status" className="text-sm text-muted-foreground">
              {status}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </div>
      )}

      {parsed && check && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Review and import</CardTitle>
            <CardDescription>
              {parsed.fileName}: {parsed.statement.transactions.length} transactions, statement date{" "}
              {parsed.statement.statementDate ?? "unknown"}. {counts.duplicates} already imported, {counts.flagged} to
              review.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-1 text-sm" aria-label="Statement checks">
              {parsed.statement.checks.map((c) => (
                <li
                  key={c.id}
                  className={cn(c.ok === false && "font-medium text-destructive", c.ok && "text-emerald-700")}
                >
                  <span aria-hidden="true">{c.ok === null ? "?" : c.ok ? "✓" : "✗"}</span>{" "}
                  <span className="sr-only">{c.ok === null ? "Not checked:" : c.ok ? "Passed:" : "Failed:"}</span>
                  {c.label} (expected {formatCents(c.expectedCents)}, got {formatCents(c.actualCents)})
                </li>
              ))}
            </ul>

            {parsed.statement.warnings.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-amber-800" aria-label="Warnings">
                {parsed.statement.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            )}

            {failedChecks.length > 0 && (
              <label className="flex items-start gap-2 rounded-md border border-destructive/40 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                />
                <span>
                  The totals don&apos;t match the statement summary, so some rows may be missing or wrong. I&apos;ve
                  reviewed the rows below and want to import anyway.
                </span>
              </label>
            )}

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <span className="sr-only">Import</span>
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ t, category, duplicate, selected }) => (
                  <TableRow
                    key={t.index}
                    className={cn(duplicate && "text-muted-foreground", !duplicate && t.flags.length > 0 && "bg-amber-50")}
                  >
                    <TableCell>
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selected}
                        disabled={duplicate || isPending || Boolean(outcome)}
                        onChange={() => toggle(t.index)}
                        aria-label={`Import ${t.date} ${t.merchant ?? t.description} ${formatCents(t.amountCents)}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{t.date}</TableCell>
                    <TableCell className="max-w-md">
                      <span className="block truncate text-sm font-medium">{t.merchant ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground">{t.description}</span>
                      {t.flags.length > 0 && (
                        <span className="mt-1 block text-xs text-amber-800">
                          {t.flags.map((f) => FLAG_LABELS[f]).join(" · ")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{category}</TableCell>
                    <TableCell
                      className={cn(
                        "whitespace-nowrap text-right tabular-nums",
                        t.type === "income" && !duplicate && "text-emerald-700",
                      )}
                    >
                      {t.type === "income" ? "+" : "−"}
                      {formatCents(t.amountCents)}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {duplicate ? "Already imported" : selected ? "New" : "Skipped"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {outcome ? (
              <div role="status" className="space-y-2 rounded-md border border-emerald-600/40 bg-emerald-50 p-4 text-sm">
                <p className="font-medium text-emerald-800">
                  Imported {outcome.inserted} transaction{outcome.inserted === 1 ? "" : "s"}
                  {outcome.skipped > 0 && `, skipped ${outcome.skipped} already in your account`}.
                </p>
                <p className="flex gap-4">
                  <Link href="/" className="underline underline-offset-4">
                    View dashboard
                  </Link>
                  <Link href="/expenses" className="underline underline-offset-4">
                    View expenses
                  </Link>
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" onClick={onImport} disabled={!canImport}>
                  {isPending ? "Importing…" : `Import ${counts.selected} transaction${counts.selected === 1 ? "" : "s"}`}
                </Button>
                {counts.selected === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing new to import from this statement.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
