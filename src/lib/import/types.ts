// Shared types for statement import. Pure TypeScript: no React, no Supabase.

/** A text fragment with its position on the page (PDF units, origin bottom-left, y grows upward). */
export interface TextItem {
  page: number; // 1-based
  str: string;
  x: number;
  y: number;
  width?: number;
}

export type AccountType = "savings" | "credit_card";
export type TransactionType = "income" | "expense";

/** Reasons a parsed row should be checked by a human before (or after) import. */
export type ReviewFlag =
  /** Description re-assembled from a reflowed page (amount/balance are still exact). */
  | "description_reconstructed"
  /** Description lines could not be matched to this row with confidence. */
  | "description_unaligned"
  /** Trailing +/- disagrees with the running-balance change; type follows the balance. */
  | "sign_mismatch"
  /** Amount does not equal the running-balance change; type follows the trailing sign. */
  | "balance_mismatch"
  | "missing_balance"
  /** Year was missing and inferred from the statement date. */
  | "date_inferred"
  /** Date is after the statement date or long before it. */
  | "date_out_of_range";

export interface ParsedTransaction {
  /** 0-based position in the statement. */
  index: number;
  page: number;
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Always positive; `type` carries the direction. */
  amount: number;
  amountCents: number;
  type: TransactionType;
  /** Running statement balance after this row, when present. */
  balance: number | null;
  balanceCents: number | null;
  description: string;
  merchant: string | null;
  flags: ReviewFlag[];
}

export interface StatementCheck {
  id: "credits" | "debits" | "closing" | "equation";
  label: string;
  expectedCents: number | null;
  actualCents: number | null;
  /** null when the statement did not provide the value needed to check. */
  ok: boolean | null;
}

export interface ParsedStatement {
  parserId: string;
  accountType: AccountType;
  statementDate: string | null;
  openingBalanceCents: number | null;
  closingBalanceCents: number | null;
  totalCreditCents: number | null;
  totalDebitCents: number | null;
  transactions: ParsedTransaction[];
  checks: StatementCheck[];
  warnings: string[];
}

export interface StatementParser {
  id: string;
  label: string;
  accountType: AccountType;
  /** Cheap sniff test on the extracted text. */
  canParse(items: ReadonlyArray<TextItem>): boolean;
  parse(items: ReadonlyArray<TextItem>): ParsedStatement;
}
