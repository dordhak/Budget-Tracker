// Transaction-type phrases and description segmentation for Maybank savings statements.
//
// A transaction's description normally starts with a type line ("SALE DEBIT",
// "IBK FUND TFR FR A/C", ...). Card-style types also END with a repeated
// "SALE DEBIT" marker line, e.g.:
//   SALE DEBIT / 99 SPEEDMART-2592 * / KUALA LUMPUR, MY / SALE DEBIT
// On some pages (page 9 of the August 2025 sample) the bank re-wraps the whole
// description column into one stream that no longer lines up with the date
// rows; these phrases let us split that stream back into transactions.

/** Leading type phrases, longest first so "PRE-AUTH REFUND" wins over "REFUND". */
export const TYPE_PHRASES: readonly string[] = [
  "IBK FUND TFR FR A/C",
  "IBK FUND TFR TO A/C",
  "FUND TRANSFER TO A/",
  "FUND TRANSFER FR A/",
  "TRANSFER FROM A/C",
  "TRANSFER TO A/C",
  "PYMT FROM A/C",
  "PYMT TO A/C",
  "PRE-AUTH REFUND",
  "PRE-AUTH DEBIT",
  "CASH WITHDRAWAL",
  "ATM WITHDRAWAL",
  "CASH DEPOSIT",
  "SERVICE CHARGE",
  "DEBIT ADVICE",
  "CREDIT ADVICE",
  "BILL PAYMENT",
  "PROFIT PAID",
  "SALE DEBIT",
  "REVERSAL",
  "DIVIDEND",
  "JOMPAY",
  "REFUND",
  "HIBAH",
].map((p) => p.toUpperCase());

const PHRASE_WORDS = TYPE_PHRASES.map((p) => p.split(" "));

/** Types whose description ends with a repeated "SALE DEBIT" marker line. */
const ENDS_WITH_SALE_DEBIT = new Set(["SALE DEBIT", "PRE-AUTH DEBIT", "PRE-AUTH REFUND", "REFUND"]);
const SALE_DEBIT = "SALE DEBIT";

const isStar = (token: string) => token === "*";

/**
 * Tries to match a type phrase starting at tokens[start]. Standalone "*" tokens
 * are skipped (the bank draws them at fixed x, so they land mid-phrase on reflowed pages).
 * Returns the phrase and the index just past it, or null.
 */
function matchPhraseAt(tokens: readonly string[], start: number): { phrase: string; end: number } | null {
  if (isStar(tokens[start] ?? "")) return null;
  for (let p = 0; p < PHRASE_WORDS.length; p++) {
    const words = PHRASE_WORDS[p];
    let i = start;
    let ok = true;
    for (const word of words) {
      while (i < tokens.length && isStar(tokens[i])) i++;
      if (i >= tokens.length || tokens[i].toUpperCase() !== word) {
        ok = false;
        break;
      }
      i++;
    }
    if (ok) return { phrase: TYPE_PHRASES[p], end: i };
  }
  return null;
}

export const tokenize = (text: string) => text.split(/\s+/).filter(Boolean);

/** Does this text start with a known transaction-type phrase? */
export function startsWithTypePhrase(text: string): boolean {
  const tokens = tokenize(text);
  let i = 0;
  while (i < tokens.length && isStar(tokens[i])) i++;
  return matchPhraseAt(tokens, i) !== null;
}

export interface Segment {
  /** Leading type phrase; null for text before the first phrase. */
  type: string | null;
  text: string;
  /** Text after the leading phrase (the phrase may contain stray "*" tokens). */
  rest: string;
}

/**
 * Splits a page's description stream into transactions.
 * A new segment starts at every type phrase, except that a "SALE DEBIT"
 * directly closing a card-style segment (which already has content) is its end marker.
 */
export function splitSegments(stream: string): Segment[] {
  const tokens = tokenize(stream);
  const segments: Array<{
    type: string | null;
    tokens: string[];
    phraseLength: number;
    hasContent: boolean;
    closed: boolean;
  }> = [];
  let current: (typeof segments)[number] | null = null;

  for (let i = 0; i < tokens.length; ) {
    const match = matchPhraseAt(tokens, i);
    if (match) {
      const phraseTokens = tokens.slice(i, match.end);
      const closesCurrent =
        match.phrase === SALE_DEBIT &&
        current !== null &&
        current.type !== null &&
        ENDS_WITH_SALE_DEBIT.has(current.type) &&
        current.hasContent &&
        !current.closed;

      if (closesCurrent && current) {
        current.tokens.push(...phraseTokens);
        current.closed = true;
      } else {
        current = {
          type: match.phrase,
          tokens: [...phraseTokens],
          phraseLength: phraseTokens.length,
          hasContent: false,
          closed: false,
        };
        segments.push(current);
      }
      i = match.end;
      continue;
    }

    if (!current) {
      current = { type: null, tokens: [], phraseLength: 0, hasContent: false, closed: false };
      segments.push(current);
    }
    current.tokens.push(tokens[i]);
    if (!isStar(tokens[i])) current.hasContent = true;
    i++;
  }

  return segments.map((s) => ({
    type: s.type,
    text: s.tokens.join(" "),
    rest: s.tokens.slice(s.phraseLength).join(" "),
  }));
}

/** Removes a trailing "SALE DEBIT" end marker from card-style descriptions. */
export function stripEndMarker(text: string, type: string | null): string {
  if (!type || !ENDS_WITH_SALE_DEBIT.has(type)) return text;
  const tokens = tokenize(text);
  const typeLength = tokenize(type).length;
  // Only strip when something besides the leading phrase remains.
  if (tokens.length > typeLength + 2 && tokens.slice(-2).join(" ").toUpperCase() === SALE_DEBIT) {
    return tokens.slice(0, -2).join(" ");
  }
  return text;
}

/** The type phrase a description starts with, if any. */
export function leadingType(text: string): string | null {
  const tokens = tokenize(text);
  let i = 0;
  while (i < tokens.length && isStar(tokens[i])) i++;
  return matchPhraseAt(tokens, i)?.phrase ?? null;
}

/** "GRAB RIDES-EC *" -> "GRAB RIDES-EC", "TNG-EWALLET ECOM 2-*" -> "TNG-EWALLET ECOM 2". */
export function cleanMerchant(text: string): string | null {
  const cleaned = text.replace(/[\s*-]+$/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length >= 2 ? cleaned : null;
}

/** "KUALA LUMPUR, MY", "ITUNES.COM, IE": a location line, not a merchant. */
const LOCATION_RE = /,\s*[A-Z]{2}$/i;
const REFERENCE_RE = /^[\d\s-]+[A-Z]?$/i; // account / reference numbers

/** Merchant from description lines laid out normally: line 0 is the type, line 1 the counterparty. */
export function merchantFromLines(lines: readonly string[]): string | null {
  const candidate = lines[1];
  if (!candidate || LOCATION_RE.test(candidate) || REFERENCE_RE.test(candidate)) return null;
  return cleanMerchant(candidate);
}

/**
 * Merchant from a reconstructed segment: the text after the type phrase up to
 * the first "*" (Maybank terminates merchant names with one). Best effort.
 */
export function merchantFromSegment(segment: Segment): string | null {
  if (!segment.type) return null;
  const tokens = tokenize(segment.rest);
  const parts: string[] = [];
  for (const token of tokens) {
    if (isStar(token)) {
      if (parts.length) break;
      continue; // stray leading star
    }
    if (token.endsWith("*")) {
      parts.push(token.slice(0, -1));
      break;
    }
    parts.push(token);
    if (parts.length > 6) return null; // no terminator found within a merchant-sized span
  }
  if (!tokens.some((t) => t.includes("*"))) return null;
  // Re-join words the reflow split after a hyphen: "SPEEDMART- 2592" -> "SPEEDMART-2592".
  return cleanMerchant(parts.join(" ").replace(/- (?=\w)/g, "-"));
}
