// Maybank / Maybank Islamic savings account statement parser (PDF text -> transactions).
//
// Layout (observed on the August 2025 statement):
//   columns  ENTRY DATE (x≈43) | DESCRIPTION (x≈88–200) | AMOUNT (right-aligned, x≈356–374) | BALANCE (x≈450)
//   body     between the column header ("STATEMENT BALANCE", y≈611) and the footer ("Perhation / Note", y≈97)
//   rows     date, amount and balance share a y; description lines follow 12 units apart and can
//            continue on the next page (after its header).
// Money comes from the amount/balance columns only, so a garbled description never changes amounts.

import { daysBetween, parseStatementDate } from "./dates";
import { groupLines, joinText, normalizeText, type Line } from "./lines";
import { centsToNumber, parseAmount, type SignedAmount } from "./money";
import {
  leadingType,
  merchantFromLines,
  merchantFromSegment,
  splitSegments,
  startsWithTypePhrase,
  stripEndMarker,
} from "./segment";
import type {
  ParsedStatement,
  ParsedTransaction,
  ReviewFlag,
  StatementCheck,
  StatementParser,
  TextItem,
  TransactionType,
} from "./types";

// Fallback layout, used only when a page's column header can't be found.
const DEFAULTS = { headerBottom: 607.9, footerTop: 96.8, descMinX: 80, amountMinX: 322, balanceMinX: 412 };
const MAX_DAYS_BEFORE_STATEMENT = 62;

interface PageLayout {
  headerBottom: number;
  footerTop: number;
  descMinX: number;
  amountMinX: number;
  balanceMinX: number;
  found: boolean;
}

interface BodyLine {
  page: number;
  y: number;
  date: string | null; // raw text
  amount: SignedAmount | null;
  balance: SignedAmount | null;
  desc: string;
}

interface DescLine {
  page: number;
  text: string;
}

interface Draft {
  page: number;
  dateText: string;
  amount: SignedAmount | null;
  balance: SignedAmount | null;
  /** Description text on the row's own line (used for the alignment check). */
  rowDesc: string;
  lines: DescLine[];
  reconstructed: { text: string; merchant: string | null } | null;
  flags: Set<ReviewFlag>;
}

const upper = (s: string) => s.toUpperCase();
const has = (items: TextItem[], text: string) => items.find((i) => upper(normalizeText(i.str)) === text);

function detectLayout(pageItems: TextItem[]): PageLayout {
  const balanceHeader = has(pageItems, "STATEMENT BALANCE");
  const amountHeader = has(pageItems, "TRANSACTION AMOUNT");
  const entryHeader = has(pageItems, "ENTRY DATE");
  const footer = pageItems.find((i) => /^PERHATIAN?\s*\/\s*NOTE/i.test(normalizeText(i.str)));

  const headerYs = [balanceHeader, amountHeader, entryHeader].filter(Boolean).map((i) => i!.y);
  return {
    headerBottom: headerYs.length ? Math.min(...headerYs) : DEFAULTS.headerBottom,
    footerTop: footer?.y ?? DEFAULTS.footerTop,
    descMinX: DEFAULTS.descMinX,
    amountMinX: amountHeader ? amountHeader.x - 5 : DEFAULTS.amountMinX,
    balanceMinX: balanceHeader ? balanceHeader.x - 5 : DEFAULTS.balanceMinX,
    found: Boolean(balanceHeader && amountHeader),
  };
}

function classify(line: Line, layout: PageLayout): BodyLine {
  let date: string | null = null;
  let amount: SignedAmount | null = null;
  let balance: SignedAmount | null = null;
  const descItems: TextItem[] = [];

  for (const item of line.items) {
    const text = normalizeText(item.str);
    if (!text) continue;
    if (item.x < layout.descMinX && date === null && parseStatementDate(text, "2000-12-31")) {
      date = text;
    } else if (item.x >= layout.balanceMinX && balance === null && parseAmount(text)) {
      balance = parseAmount(text);
    } else if (item.x >= layout.amountMinX && item.x < layout.balanceMinX && amount === null && parseAmount(text)) {
      amount = parseAmount(text);
    } else {
      descItems.push({ ...item, str: text });
    }
  }
  return { page: line.page, y: line.y, date, amount, balance, desc: joinText(descItems) };
}

function findStatementDate(items: ReadonlyArray<TextItem>, layouts: Map<number, PageLayout>): string | null {
  const firstPage = Math.min(...items.map((i) => i.page));
  const layout = layouts.get(firstPage);
  const candidates = items
    .filter((i) => i.page === firstPage && i.x > 300 && (!layout || i.y > layout.headerBottom))
    .map((i) => parseStatementDate(normalizeText(i.str)))
    .filter((d): d is NonNullable<typeof d> => d !== null && !d.inferredYear);
  return candidates[0]?.iso ?? null;
}

export function parseMaybankSavings(items: ReadonlyArray<TextItem>): ParsedStatement {
  const warnings: string[] = [];
  const pages = [...new Set(items.map((i) => i.page))].sort((a, b) => a - b);

  const layouts = new Map<number, PageLayout>();
  for (const page of pages) {
    const layout = detectLayout(items.filter((i) => i.page === page));
    if (!layout.found) warnings.push(`Page ${page}: column header not found; using default column positions.`);
    layouts.set(page, layout);
  }

  const statementDate = findStatementDate(items, layouts);
  if (!statementDate) warnings.push("Statement date not found; dates without a year can't be resolved.");

  let openingBalance: number | null = null;
  let closingBalance: number | null = null;
  let totalCredit: number | null = null;
  let totalDebit: number | null = null;
  let ended = false;

  const drafts: Draft[] = [];
  /** Per page: description lines in reading order, rows that start on it, and the row continuing into it. */
  const pageInfo = new Map<number, { stream: DescLine[]; rows: Draft[]; carry: Draft | null }>();

  for (const page of pages) {
    const layout = layouts.get(page)!;
    const info: { stream: DescLine[]; rows: Draft[]; carry: Draft | null } = {
      stream: [],
      rows: [],
      carry: drafts[drafts.length - 1] ?? null,
    };
    pageInfo.set(page, info);

    // Never stitch the previous row across a page whose header is missing.
    if (!layout.found) info.carry = null;

    const pageItems = items.filter(
      (i) => i.page === page && i.y < layout.headerBottom - 1 && i.y > layout.footerTop + 1 && i.str.trim() !== "",
    );

    for (const line of groupLines(pageItems).map((l) => classify(l, layout))) {
      const desc = upper(line.desc);

      if (ended) {
        const value = line.amount ?? line.balance;
        if (desc.startsWith("TOTAL CREDIT") && value) totalCredit = value.cents;
        else if (desc.startsWith("TOTAL DEBIT") && value) totalDebit = value.cents;
        continue;
      }
      if (desc.startsWith("BEGINNING BALANCE")) {
        openingBalance = (line.balance ?? line.amount)?.cents ?? null;
        continue;
      }
      if (desc.startsWith("ENDING BALANCE")) {
        closingBalance = (line.amount ?? line.balance)?.cents ?? null;
        ended = true;
        continue;
      }

      if (line.date) {
        const draft: Draft = {
          page,
          dateText: line.date,
          amount: line.amount,
          balance: line.balance,
          rowDesc: line.desc,
          lines: line.desc ? [{ page, text: line.desc }] : [],
          reconstructed: null,
          flags: new Set(),
        };
        if (line.amount) {
          drafts.push(draft);
          info.rows.push(draft);
        } else {
          warnings.push(`Page ${page}: row dated ${line.date} has no amount; skipped.`);
        }
        if (line.desc) info.stream.push({ page, text: line.desc });
        continue;
      }

      if (line.amount || line.balance) {
        warnings.push(`Page ${page}: amount "${line.desc || "?"}" found without a date; ignored.`);
      }
      if (line.desc) {
        info.stream.push({ page, text: line.desc });
        const target = drafts[drafts.length - 1];
        if (target) target.lines.push({ page, text: line.desc });
      }
    }
  }

  if (!ended) warnings.push("ENDING BALANCE line not found; the statement may be incomplete.");

  // Pages whose description column doesn't line up with the date rows (e.g. the reflowed page 9).
  for (const [page, info] of pageInfo) {
    if (info.rows.length === 0) continue;
    const misaligned = info.rows.filter((r) => !startsWithTypePhrase(r.rowDesc));
    if (misaligned.length === 0) continue;

    const segments = splitSegments(info.stream.map((l) => l.text).join(" "));
    const n = info.rows.length;
    const withCarry = segments.length === n + 1 && info.carry !== null;
    const own = withCarry ? segments.slice(1) : segments;
    // Only trust the split when the counts line up AND every row's segment starts with a known type.
    const trusted = (segments.length === n || withCarry) && own.every((s) => s.type !== null);

    if (trusted) {
      if (info.carry) info.carry.lines = info.carry.lines.filter((l) => l.page !== page);
      if (withCarry && info.carry) info.carry.lines.push({ page, text: segments[0].text });
      info.rows.forEach((row, i) => {
        row.reconstructed = {
          text: stripEndMarker(own[i].text, own[i].type),
          merchant: merchantFromSegment(own[i]),
        };
        row.flags.add("description_reconstructed");
      });
      warnings.push(
        `Page ${page}: descriptions were reflowed by the bank; re-assembled ${n} of them. Amounts and balances are unaffected.`,
      );
    } else {
      misaligned.forEach((row) => row.flags.add("description_unaligned"));
      warnings.push(`Page ${page}: ${misaligned.length} description(s) could not be matched to their rows reliably.`);
    }
  }

  // Resolve dates, types and descriptions; validate against the running balance.
  const transactions: ParsedTransaction[] = [];
  let previousBalance = openingBalance;

  for (const draft of drafts) {
    const flags = draft.flags;
    const parsedDate = parseStatementDate(draft.dateText, statementDate);
    if (!parsedDate) {
      warnings.push(`Page ${draft.page}: could not read the date "${draft.dateText}"; row skipped.`);
      continue;
    }
    if (parsedDate.inferredYear) flags.add("date_inferred");
    if (statementDate) {
      const gap = daysBetween(parsedDate.iso, statementDate);
      if (gap < 0 || gap > MAX_DAYS_BEFORE_STATEMENT) flags.add("date_out_of_range");
    }

    const amount = draft.amount!;
    const balance = draft.balance;
    let type: TransactionType;

    if (!balance) {
      flags.add("missing_balance");
      type = amount.sign === "+" ? "income" : "expense";
    } else if (previousBalance !== null && Math.abs(balance.cents - previousBalance) === amount.cents && amount.cents > 0) {
      // The balance change is the source of truth.
      type = balance.cents > previousBalance ? "income" : "expense";
      if (amount.sign && (amount.sign === "+") !== (type === "income")) flags.add("sign_mismatch");
    } else {
      if (previousBalance !== null) flags.add("balance_mismatch");
      type = amount.sign === "+" ? "income" : amount.sign === "-" ? "expense" : (balance.cents >= (previousBalance ?? 0) ? "income" : "expense");
    }
    if (balance) previousBalance = balance.cents;

    let description: string;
    let merchant: string | null;
    if (draft.reconstructed) {
      description = draft.reconstructed.text;
      merchant = draft.reconstructed.merchant;
    } else {
      const lines = draft.lines.map((l) => l.text);
      description = stripEndMarker(lines.join(" "), leadingType(lines[0] ?? ""));
      merchant = merchantFromLines(lines);
    }

    transactions.push({
      index: transactions.length,
      page: draft.page,
      date: parsedDate.iso,
      amount: centsToNumber(amount.cents),
      amountCents: amount.cents,
      type,
      balance: balance ? centsToNumber(balance.cents) : null,
      balanceCents: balance?.cents ?? null,
      description: normalizeText(description),
      merchant,
      flags: [...flags],
    });
  }

  return {
    parserId: maybankSavingsParser.id,
    accountType: "savings",
    statementDate,
    openingBalanceCents: openingBalance,
    closingBalanceCents: closingBalance,
    totalCreditCents: totalCredit,
    totalDebitCents: totalDebit,
    transactions,
    checks: buildChecks(transactions, openingBalance, closingBalance, totalCredit, totalDebit),
    warnings,
  };
}

function buildChecks(
  txns: ParsedTransaction[],
  opening: number | null,
  closing: number | null,
  totalCredit: number | null,
  totalDebit: number | null,
): StatementCheck[] {
  const credits = txns.filter((t) => t.type === "income").reduce((s, t) => s + t.amountCents, 0);
  const debits = txns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amountCents, 0);
  const lastBalance = [...txns].reverse().find((t) => t.balanceCents !== null)?.balanceCents ?? null;
  const check = (
    id: StatementCheck["id"],
    label: string,
    expected: number | null,
    actual: number | null,
  ): StatementCheck => ({
    id,
    label,
    expectedCents: expected,
    actualCents: actual,
    ok: expected === null || actual === null ? null : expected === actual,
  });

  return [
    check("credits", "Credits match TOTAL CREDIT", totalCredit, credits),
    check("debits", "Debits match TOTAL DEBIT", totalDebit, debits),
    check("closing", "Last balance matches ENDING BALANCE", closing, lastBalance),
    check("equation", "Opening + credits − debits = ending", closing, opening === null ? null : opening + credits - debits),
  ];
}

export const maybankSavingsParser: StatementParser = {
  id: "maybank-savings",
  label: "Maybank savings account (PDF)",
  accountType: "savings",
  canParse(items) {
    // pdfjs item order varies, so look at all of it (a statement is only a few thousand items).
    const text = upper(items.map((i) => normalizeText(i.str)).join(" "));
    return text.includes("MAYBANK") && text.includes("STATEMENT BALANCE") && text.includes("TRANSACTION AMOUNT");
  },
  parse: parseMaybankSavings,
};
