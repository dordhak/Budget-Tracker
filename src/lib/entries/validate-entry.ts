// Validation for the add/edit entry form. Server Actions are public endpoints,
// so everything from the client is re-checked here. Pure and unit tested.
import { parseCategory, parseMoney } from "@/lib/budget";

export type EntryType = "income" | "expense";
export type PaymentMethod = "bank" | "cash";
export type EntrySource = "manual" | "receipt_image" | "receipt_pdf";

export interface EntryInput {
  date: string;
  amount: number;
  type: EntryType;
  category: string;
  merchant: string | null;
  notes: string | null;
  payment_method: PaymentMethod;
  source: EntrySource;
  receipt_path: string | null;
}

export type EntryFormError = { error: string; field: string };
type FormLike = { get(name: string): unknown };

export const MAX_MERCHANT = 120;
export const MAX_NOTES = 2000;
const MAX_FUTURE_DAYS = 1; // allows for timezone edges
const MAX_PAST_YEARS = 10;

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Today's date (YYYY-MM-DD) in Malaysia, independent of the server/browser timezone. */
export function todayIso(timeZone = "Asia/Kuala_Lumpur", now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isRealDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(iso);
}

/** Receipt objects must live in the user's own folder with a name we generated. */
export function isOwnReceiptPath(path: string, userId: string): boolean {
  const escaped = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|pdf)$`).test(path);
}

export function parseEntryForm(
  form: FormLike,
  userId: string,
  today: string = todayIso(),
): EntryInput | EntryFormError {
  const type = str(form.get("type"));
  if (type !== "income" && type !== "expense") return { error: "Choose income or expense.", field: "type" };

  const amount = parseMoney(str(form.get("amount")));
  if (amount === null || amount <= 0) {
    return { error: "Enter an amount greater than 0 (max 2 decimals).", field: "amount" };
  }

  const date = str(form.get("date"));
  if (!isRealDate(date)) return { error: "Enter a valid date.", field: "date" };
  if (date > addDays(today, MAX_FUTURE_DAYS)) return { error: "The date can't be in the future.", field: "date" };
  if (date < `${Number(today.slice(0, 4)) - MAX_PAST_YEARS}${today.slice(4)}`) {
    return { error: `The date must be within the last ${MAX_PAST_YEARS} years.`, field: "date" };
  }

  const payment = str(form.get("payment_method")) || "bank";
  if (payment !== "bank" && payment !== "cash") return { error: "Choose bank or cash.", field: "payment_method" };

  const rawCategory = str(form.get("category"));
  const category = rawCategory.trim() === "" ? "Uncategorized" : parseCategory(rawCategory);
  if (!category) return { error: "Categories can be at most 60 characters.", field: "category" };

  const merchant = str(form.get("merchant")).replace(/\s+/g, " ").trim();
  if (merchant.length > MAX_MERCHANT) {
    return { error: `Merchant can be at most ${MAX_MERCHANT} characters.`, field: "merchant" };
  }

  const notes = str(form.get("notes")).replace(/\r\n/g, "\n").trim();
  if (notes.length > MAX_NOTES) return { error: `Notes can be at most ${MAX_NOTES} characters.`, field: "notes" };

  const receiptPath = str(form.get("receipt_path")).trim();
  if (receiptPath && !isOwnReceiptPath(receiptPath, userId)) {
    return { error: "The receipt upload is invalid. Please attach it again.", field: "receipt" };
  }

  const rawSource = str(form.get("source")) || "manual";
  if (rawSource !== "manual" && rawSource !== "receipt_image" && rawSource !== "receipt_pdf") {
    return { error: "Invalid entry source.", field: "receipt" };
  }

  return {
    date,
    amount,
    type,
    category,
    merchant: merchant || null,
    notes: notes || null,
    payment_method: payment,
    source: rawSource,
    receipt_path: receiptPath || null,
  };
}
