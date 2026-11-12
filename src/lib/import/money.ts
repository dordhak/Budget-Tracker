// Money is handled in integer cents to avoid floating point drift in sums/checks.

export interface SignedAmount {
  cents: number; // always >= 0
  sign: "+" | "-" | null;
}

/** Matches Maybank amounts: "21.00-", "2,090.47+", "1,074.30" (sign optional, trailing). */
const AMOUNT_RE = /^(\d{1,3}(?:,\d{3})*|\d+)\.(\d{2})([+-])?$/;

export function isAmount(text: string): boolean {
  return AMOUNT_RE.test(text.trim());
}

export function parseAmount(text: string): SignedAmount | null {
  const match = AMOUNT_RE.exec(text.trim());
  if (!match) return null;
  const whole = Number(match[1].replace(/,/g, ""));
  const cents = whole * 100 + Number(match[2]);
  if (!Number.isSafeInteger(cents)) return null;
  return { cents, sign: (match[3] as "+" | "-" | undefined) ?? null };
}

export const centsToNumber = (cents: number) => cents / 100;

export function formatCents(cents: number | null): string {
  if (cents == null) return "—";
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString("en-MY");
  return `${sign}${whole}.${String(abs % 100).padStart(2, "0")}`;
}
