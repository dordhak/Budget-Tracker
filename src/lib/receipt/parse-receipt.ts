// Suggests amount, date, merchant and type from receipt text (OCR or PDF text layer).
// Pure and unit tested. The result only pre-fills a form: the user always confirms it.

export type Confidence = "high" | "low";

export interface ReceiptSuggestion {
  amountCents: number | null;
  amountConfidence: Confidence;
  date: string | null; // ISO YYYY-MM-DD
  merchant: string | null;
  type: "income" | "expense";
}

export interface ParseReceiptOptions {
  /** ISO date treated as "today" (dates after it are ignored). Defaults to the real today. */
  today?: string;
}

// ---------------------------------------------------------------- amounts

/** "RM 1,234.50", "12.50", "MYR12.50", OCR-style "12,50". Captures whole and cents. */
const MONEY_SOURCE = String.raw`(?:RM|MYR)?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{2})|,(\d{2}))(?![\d.,]*\d)`;
const MONEY_RE = new RegExp(MONEY_SOURCE, "gi"); // for matchAll only (global regexes keep state)
const HAS_MONEY_RE = new RegExp(MONEY_SOURCE, "i");

/** Higher weight = more likely to be the amount actually paid. */
const TOTAL_KEYWORDS: ReadonlyArray<[RegExp, number]> = [
  [/\b(grand\s*total|total\s*paid|amount\s*paid|total\s*amount|order\s*total|net\s*total|jumlah\s*bayar|total\s*payable)\b/i, 5],
  [/\b(total|jumlah|amount|amaun)\b/i, 3],
  [/\b(paid|bayaran|payment)\b/i, 2],
];

/** Lines whose amount is never the total paid. */
const NOT_TOTAL_RE =
  /\b(sub\s*-?\s*total|tax|sst|gst|service\s*charge|rounding|round\s*adj|change|baki|cash|tunai|tendered|discount|diskaun|savings|balance|points?|qty|unit\s*price)\b|@/i;

interface MoneyHit {
  cents: number;
  line: number;
}

function moneyOnLine(line: string, index: number): MoneyHit[] {
  const hits: MoneyHit[] = [];
  for (const m of line.matchAll(MONEY_RE)) {
    const whole = Number(m[1].replace(/,/g, ""));
    const cents = whole * 100 + Number(m[2] ?? m[3]);
    if (cents > 0 && cents < 100_000_000) hits.push({ cents, line: index });
  }
  return hits;
}

function findAmount(lines: string[]): { cents: number | null; confidence: Confidence } {
  let best: { cents: number; score: number; line: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (NOT_TOTAL_RE.test(line)) continue;
    const weight = TOTAL_KEYWORDS.find(([re]) => re.test(line))?.[1] ?? 0;
    if (weight === 0) continue;
    // Amount on the keyword line, or on the next line ("TOTAL" / "12.50").
    let hits = moneyOnLine(line, i);
    if (hits.length === 0 && lines[i + 1] && !NOT_TOTAL_RE.test(lines[i + 1])) hits = moneyOnLine(lines[i + 1], i + 1);
    const hit = hits.at(-1);
    // Prefer stronger keywords, then lines further down (totals sit at the bottom).
    if (hit && (!best || weight > best.score || (weight === best.score && hit.line >= best.line))) {
      best = { cents: hit.cents, score: weight, line: hit.line };
    }
  }
  if (best) return { cents: best.cents, confidence: "high" };

  // No labelled total: fall back to the largest plausible amount.
  const all = lines.flatMap((line, i) => (NOT_TOTAL_RE.test(line) ? [] : moneyOnLine(line, i)));
  if (all.length === 0) return { cents: null, confidence: "low" };
  return { cents: Math.max(...all.map((h) => h.cents)), confidence: "low" };
}

// ---------------------------------------------------------------- dates

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januari: 1,
  feb: 2, february: 2, februari: 2,
  mar: 3, march: 3, mac: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, june: 6,
  jul: 7, july: 7, julai: 7,
  aug: 8, august: 8, ogos: 8, ogo: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12, dis: 12, disember: 12,
};
const MONTH_NAMES = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join("|");

const DATE_PATTERNS: ReadonlyArray<{ re: RegExp; order: "dmy" | "ymd" | "dMy" | "Mdy" }> = [
  { re: /\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, order: "ymd" },
  { re: /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g, order: "dmy" }, // Malaysia: day first
  { re: new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?[\\s-]+(${MONTH_NAMES})\\.?[\\s,-]+(\\d{4}|\\d{2})\\b`, "gi"), order: "dMy" },
  { re: new RegExp(`\\b(${MONTH_NAMES})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "gi"), order: "Mdy" },
];

function toIso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

function findDate(text: string, today: string): string | null {
  const earliest = `${Number(today.slice(0, 4)) - 2}${today.slice(4)}`;
  const found: Array<{ iso: string; index: number }> = [];

  for (const { re, order } of DATE_PATTERNS) {
    for (const m of text.matchAll(re)) {
      let iso: string | null = null;
      if (order === "ymd") iso = toIso(+m[1], +m[2], +m[3]);
      else if (order === "dmy") iso = toIso(+m[3], +m[2], +m[1]);
      else if (order === "dMy") iso = toIso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]);
      else iso = toIso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]);
      // Ignore future dates and anything older than two years (likely an expiry or reg. number).
      if (iso && iso <= today && iso >= earliest) found.push({ iso, index: m.index ?? 0 });
    }
  }
  found.sort((a, b) => a.index - b.index);
  return found[0]?.iso ?? null;
}

// ---------------------------------------------------------------- merchant & type

/** Labelled counterparties in banking / e-wallet receipts ("Recipient: ALI BIN ABU"). */
const PARTY_LABEL_RE =
  /^(?:recipient(?:\s*name)?|paid\s*to|transfer(?:red)?\s*to|beneficiary(?:\s*name)?|merchant(?:\s*name)?|received\s*from|sender(?:\s*name)?|from)\s*[:\-]?\s*(.*)$/i;

const NOISE_RE =
  /\b(receipt|resit|tax\s*invoice|invoice|welcome|thank|terima\s*kasih|tel|phone|fax|email|www\.|https?:|gst|sst|reg(?:istration)?\s*no|co\.?\s*no|date|time|cashier|table|order\s*(?:no|id)|booking|reference|ref\.?\s*no|transaction\s*(?:id|no)|successful|status)\b/i;

function cleanName(text: string): string | null {
  const cleaned = text.replace(/[|*_=~]+/g, " ").replace(/\s+/g, " ").trim().replace(/[\s:.,-]+$/, "");
  return cleaned.length >= 3 && cleaned.length <= 60 ? cleaned : null;
}

function findMerchant(lines: string[]): string | null {
  for (let i = 0; i < lines.length; i++) {
    const m = PARTY_LABEL_RE.exec(lines[i]);
    if (m) {
      const value = cleanName(m[1]) ?? (lines[i + 1] ? cleanName(lines[i + 1]) : null);
      if (value && !NOISE_RE.test(value)) return value;
    }
  }
  // Otherwise the shop name is usually one of the first lines.
  for (const line of lines.slice(0, 6)) {
    const letters = (line.match(/\p{L}/gu) ?? []).length;
    if (letters < 3 || letters / line.length < 0.5 || NOISE_RE.test(line) || HAS_MONEY_RE.test(line)) continue;
    const name = cleanName(line);
    if (name) return name;
  }
  return null;
}

const INCOME_RE = /\b(you\s+received|received\s+from|money\s+in|credited|incoming|deposit(?:ed)?|salary|gaji|refund(?:ed)?)\b/i;
const EXPENSE_RE = /\b(paid\s+to|you\s+paid|payment|purchase|sale|debit(?:ed)?|transfer(?:red)?\s+to|total)\b/i;

function findType(text: string): "income" | "expense" {
  const income = text.match(new RegExp(INCOME_RE, "gi"))?.length ?? 0;
  const expense = text.match(new RegExp(EXPENSE_RE, "gi"))?.length ?? 0;
  return income > expense ? "income" : "expense";
}

// ---------------------------------------------------------------- entry point

const isoToday = () => new Date().toISOString().slice(0, 10);

export function parseReceiptText(text: string, options: ParseReceiptOptions = {}): ReceiptSuggestion {
  const normalized = text.normalize("NFKC");
  const lines = normalized
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const amount = findAmount(lines);

  return {
    amountCents: amount.cents,
    amountConfidence: amount.confidence,
    date: findDate(lines.join("\n"), options.today ?? isoToday()),
    merchant: findMerchant(lines),
    type: findType(normalized),
  };
}
