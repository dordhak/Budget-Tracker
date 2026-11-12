// Validation for the /expenses/[id] edit form. Pure and unit tested.
import { parseCategory } from "./budget";

export const MAX_NOTES = 2000;
export const MAX_KEYWORD = 100;
export const MIN_KEYWORD = 2;

export interface TransactionUpdate {
  category: string;
  notes: string | null;
  /** Set when the user asked to save the category as a keyword rule. */
  rule: { keyword: string; category: string } | null;
}

type FormLike = { get(name: string): unknown };

export function parseTransactionUpdate(form: FormLike): TransactionUpdate | { error: string; field: string } {
  const category = parseCategory(form.get("category"));
  if (!category) return { error: "Enter a category (1–60 characters).", field: "category" };

  const rawNotes = typeof form.get("notes") === "string" ? (form.get("notes") as string) : "";
  // Keep the user's line breaks; just trim the ends and normalize Windows newlines.
  const notes = rawNotes.replace(/\r\n/g, "\n").trim();
  if (notes.length > MAX_NOTES) return { error: `Notes can be at most ${MAX_NOTES} characters.`, field: "notes" };

  let rule: TransactionUpdate["rule"] = null;
  if (form.get("save_rule") === "on") {
    const keyword = typeof form.get("keyword") === "string" ? (form.get("keyword") as string).replace(/\s+/g, " ").trim() : "";
    if (keyword.length < MIN_KEYWORD || keyword.length > MAX_KEYWORD) {
      return { error: `The keyword must be ${MIN_KEYWORD}–${MAX_KEYWORD} characters.`, field: "keyword" };
    }
    rule = { keyword, category };
  }

  return { category, notes: notes || null, rule };
}

/** Escapes LIKE wildcards so a keyword can be matched exactly with ILIKE. */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Suggested rule keyword from a merchant name: drops trailing store numbers and
 * branch codes ("99 SPEEDMART-2592" -> "99 SPEEDMART", "KK SUPER MART-EPM" -> "KK SUPER MART").
 */
export function suggestKeyword(merchant: string | null | undefined): string {
  if (!merchant) return "";
  const full = merchant.toUpperCase().replace(/\s+/g, " ").trim();
  const base = full
    .replace(/-[A-Z0-9]{1,5}$/, "") // short code after a hyphen: "-2592", "-EPM", "-EC"
    .replace(/\s+\d+$/, "") // trailing number: "ECOM 2"
    .replace(/[\s*-]+$/, "")
    .trim();
  return base.length >= MIN_KEYWORD ? base : full;
}
