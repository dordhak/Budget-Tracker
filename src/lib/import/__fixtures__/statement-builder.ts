// Builds synthetic pdfjs-style text items that mimic a Maybank savings statement.
// Coordinates mirror the real August 2025 statement (see maybank-aug-2025.ts):
//   description lines start at y=596.8 and step 12 units, 41 lines per page;
//   date/amount/balance sit 0.4 above their row's first description line.
import type { TextItem } from "../types";

export interface FixtureRow {
  date: string; // as printed, e.g. "01/08/25"
  amount: string; // as printed, e.g. "21.00-" / "500.00+"
  lines: string[]; // description lines
  /** Override the printed balance (otherwise computed from the opening balance). */
  balance?: string;
}

export interface BuildOptions {
  statementDate: string; // "31/08/25"
  opening: string | null; // "1,074.30"; null = no BEGINNING BALANCE line
  rows: FixtureRow[];
  linesPerPage?: number;
  /** Append ENDING BALANCE / TOTAL CREDIT / TOTAL DEBIT after the rows. */
  summary?: boolean;
  /** Hand-made body items for extra pages after the generated ones (header/footer are added). */
  extraPages?: Array<Array<Omit<TextItem, "page">>>;
}

const TOP = 596.8;
const STEP = 12;
const X = { date: 43.4, desc: 87.7, star: 160, balance: 450, summaryValue: 361.8 };

export function r(date: string, amount: string, ...lines: string[]): FixtureRow {
  return { date, amount, lines };
}

const toCents = (s: string) => {
  const m = /^([\d,]+)\.(\d{2})([+-])?$/.exec(s);
  if (!m) throw new Error(`bad fixture amount ${s}`);
  const cents = Number(m[1].replace(/,/g, "")) * 100 + Number(m[2]);
  return m[3] === "-" ? -cents : cents;
};
export const fmt = (cents: number) =>
  `${Math.floor(Math.abs(cents) / 100).toLocaleString("en-US")}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;

/** Right-aligned amount column, matching observed x for "5.30-" (374.4) … "2,090.47+" (356.0). */
const amountX = (s: string) => 396 - s.length * 4.4;

export function headerFooter(page: number, statementDate: string): TextItem[] {
  const t = (x: number, y: number, str: string): TextItem => ({ page, x, y, str });
  return [
    t(216.1, 769.4, "Maybank Islamic Berhad (787435-M)"),
    t(171.1, 760.4, "15th Floor, Tower A, Dataran Maybank, 1, Jalan Maarof, 59000 Kuala Lumpur"),
    t(25.0, 747.8, String(page).padStart(6, "0")),
    t(76.0, 747.8, "BRANCH NAME"),
    t(320.7, 747.0, "MUKA/"),
    t(344.4, 747.0, "\u2FB4"), // Kangxi radical, as in the real header
    t(351.5, 747.0, "/PAGE"),
    t(480.1, 747.5, String(page)),
    t(322.3, 734.7, "TARIKH PENYATA"),
    t(448.7, 722.5, statementDate),
    t(321.1, 714.7, "STATEMENT DATE"),
    t(76.8, 721.0, "CUSTOMER NAME"),
    t(76.8, 712.0, "ADDRESS LINE 1"),
    t(322.9, 701.7, "NOMBOR AKAUN"),
    t(422.9, 687.3, "(xxxxxx-xxxxx)"),
    t(25.0, 655.2, "PROTECTED BY PIDM UP TO RM250,000 FOR EACH DEPOSITOR"),
    t(409.2, 655.2, "SAVINGS ACCOUNT-I"),
    t(140.5, 640.1, "URUSNIAGA AKAUN/"),
    t(280.2, 640.1, "/ACCOUNT TRANSACTIONS"),
    t(34.8, 627.9, "TARIKH MASUK"),
    t(174.7, 627.9, "BUTIR URUSNIAGA"),
    t(330.9, 627.9, "JUMLAH URUSNIAGA"),
    t(426.2, 627.9, "BAKI PENYATA"),
    t(163.0, 611.4, "TRANSACTION DESCRIPTION"),
    t(327.4, 611.4, "TRANSACTION AMOUNT"),
    t(417.9, 611.4, "STATEMENT BALANCE"),
    t(36.5, 607.9, "ENTRY DATE"),
    t(25.0, 96.8, "Perhation / Note"),
    t(25.0, 88.8, "(1)"),
    t(38.9, 88.8, "Semua maklumat dan baki yang dinyatakan di sini akan dianggap betul"),
    t(66.9, 76.0, "21"),
    t(38.9, 70.8, "All items and balances shown will be considered correct unless the Bank is notified"),
    t(25.0, 60.8, "(2)"),
    t(38.9, 47.5, "Please notify us of any change of address in writing."),
  ];
}

/** Description items; a trailing " *" becomes a separate star item, as pdfjs reports it. */
function descItems(page: number, y: number, text: string): TextItem[] {
  if (text.endsWith(" *")) {
    return [
      { page, x: X.desc, y, str: text.slice(0, -2) },
      { page, x: X.star, y, str: "*" },
    ];
  }
  return [{ page, x: X.desc, y, str: text }];
}

export function buildStatement(opts: BuildOptions): TextItem[] {
  const perPage = opts.linesPerPage ?? 41;
  const items: TextItem[] = [];
  let page = 1;
  let slot = 0;
  let balance = opts.opening ? toCents(opts.opening) : 0;
  let credits = 0;
  let debits = 0;

  const descY = () => TOP - STEP * slot;
  const nextSlot = () => {
    slot++;
    if (slot >= perPage) {
      page++;
      slot = 0;
    }
  };

  if (opts.opening) {
    items.push(...descItems(page, descY(), "BEGINNING BALANCE"));
    items.push({ page, x: X.balance, y: descY() + 0.4, str: opts.opening });
    nextSlot();
  }

  for (const row of opts.rows) {
    const delta = toCents(row.amount);
    balance += delta;
    if (delta >= 0) credits += delta;
    else debits -= delta;
    const printedBalance = row.balance ?? fmt(balance);
    if (row.balance) balance = toCents(row.balance);

    const rowY = descY() + 0.4;
    items.push({ page, x: X.date, y: rowY, str: row.date });
    items.push({ page, x: amountX(row.amount), y: rowY, str: row.amount });
    items.push({ page, x: X.balance, y: rowY, str: printedBalance });

    if (row.lines.length === 0) nextSlot();
    for (const line of row.lines) {
      items.push(...descItems(page, descY(), line));
      nextSlot();
    }
  }

  if (opts.summary) {
    slot += 2;
    const summaryLines: Array<[string, number]> = [
      ["ENDING BALANCE :", balance],
      ["TOTAL CREDIT :", credits],
      ["TOTAL DEBIT :", debits],
    ];
    for (const [label, cents] of summaryLines) {
      items.push({ page, x: X.desc, y: descY(), str: label });
      items.push({ page, x: X.summaryValue, y: descY(), str: fmt(cents) });
      slot++;
    }
  }

  const generatedPages = slot === 0 && page > 1 ? page - 1 : page;
  for (const extra of opts.extraPages ?? []) {
    const p = (items.length ? Math.max(generatedPages, ...items.map((i) => i.page)) : 0) + 1;
    items.push(...extra.map((i) => ({ ...i, page: p })));
  }

  const lastPage = Math.max(...items.map((i) => i.page));
  for (let p = 1; p <= lastPage; p++) items.push(...headerFooter(p, opts.statementDate));
  return items;
}

/** Deterministic shuffle: pdfjs does not return items in reading order. */
export function shuffled<T>(arr: readonly T[], seed = 42): T[] {
  const out = [...arr];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) % 2 ** 31;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
