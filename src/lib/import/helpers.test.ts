import { describe, expect, it } from "vitest";
import { categorize, UNCATEGORIZED } from "./categorize";
import { parseStatementDate } from "./dates";
import { computeDedupeKeys, dedupeMaterial } from "./dedupe";
import { formatCents, parseAmount } from "./money";
import { splitSegments, startsWithTypePhrase } from "./segment";

describe("parseAmount", () => {
  it.each([
    ["21.00-", { cents: 2100, sign: "-" }],
    ["500.00+", { cents: 50000, sign: "+" }],
    ["2,090.47+", { cents: 209047, sign: "+" }],
    ["1,074.30", { cents: 107430, sign: null }],
    ["1234.56", { cents: 123456, sign: null }],
  ])("%s", (input, expected) => {
    expect(parseAmount(input)).toEqual(expected);
  });

  it.each(["21.0-", "-21.00", "1,23.00", "abc", "", "12.345"])("rejects %s", (input) => {
    expect(parseAmount(input)).toBeNull();
  });

  it("formats cents", () => {
    expect(formatCents(442388)).toBe("4,423.88");
    expect(formatCents(-5)).toBe("-0.05");
    expect(formatCents(null)).toBe("—");
  });
});

describe("parseStatementDate", () => {
  it("expands two-digit years", () => {
    expect(parseStatementDate("01/08/25")).toEqual({ iso: "2025-08-01", inferredYear: false });
  });

  it("rejects impossible dates", () => {
    expect(parseStatementDate("31/02/25")).toBeNull();
    expect(parseStatementDate("01/13/25")).toBeNull();
  });

  it("needs a reference date when the year is missing", () => {
    expect(parseStatementDate("01/08")).toBeNull();
    expect(parseStatementDate("01/08", "2025-08-31")).toEqual({ iso: "2025-08-01", inferredYear: true });
  });
});

describe("segmentation", () => {
  it("recognizes type phrases, ignoring stray stars", () => {
    expect(startsWithTypePhrase("SALE DEBIT")).toBe(true);
    expect(startsWithTypePhrase("* IBK FUND TFR FR A/C")).toBe(true);
    expect(startsWithTypePhrase("APU-BILABILA RETAIL*")).toBe(false);
  });

  it("splits a stream where card rows end with a SALE DEBIT marker", () => {
    const segments = splitSegments(
      "SALE DEBIT SHOP A* KL, MY SALE DEBIT SALE DEBIT SHOP B* KL, MY SALE DEBIT IBK FUND TFR FR A/C PAYEE 123 DUITNOW QR SALE DEBIT SHOP C* KL, MY SALE",
    );
    expect(segments.map((s) => s.text)).toEqual([
      "SALE DEBIT SHOP A* KL, MY SALE DEBIT",
      "SALE DEBIT SHOP B* KL, MY SALE DEBIT",
      "IBK FUND TFR FR A/C PAYEE 123 DUITNOW QR",
      "SALE DEBIT SHOP C* KL, MY SALE",
    ]);
  });

  it("matches a phrase split by a stray star", () => {
    expect(splitSegments("SALE * DEBIT X* SALE DEBIT").map((s) => s.type)).toEqual(["SALE DEBIT"]);
  });
});

describe("categorize", () => {
  const rules = [
    { keyword: "grab rides", category: "Transport", priority: 10 },
    { keyword: "GRAB", category: "Food", priority: 10 },
    { keyword: "google", category: "Subscriptions", priority: 30 },
    { keyword: "hibah", category: "Profit", priority: 5 },
  ];

  it("matches case-insensitively on merchant and description", () => {
    expect(categorize({ merchant: "GRAB RIDES-EC", description: "SALE DEBIT" }, rules)).toBe("Transport");
  });

  it("prefers lower priority, then the longer keyword", () => {
    expect(categorize({ merchant: null, description: "PROFIT PAID HIBAH GOOGLE" }, rules)).toBe("Profit");
    expect(categorize({ merchant: null, description: "SALE DEBIT GRAB RIDES-EC" }, rules)).toBe("Transport");
  });

  it("falls back to Uncategorized", () => {
    expect(categorize({ merchant: null, description: "SOMETHING ELSE" }, rules)).toBe(UNCATEGORIZED);
    expect(categorize({ merchant: null, description: "x" }, [])).toBe(UNCATEGORIZED);
  });
});

describe("dedupe keys", () => {
  const row = { date: "2025-08-01", type: "expense" as const, amountCents: 2100, balanceCents: 105330 };

  it("is a deterministic SHA-256 hex digest", async () => {
    const [a] = await computeDedupeKeys([row], "acct-1");
    const [b] = await computeDedupeKeys([row], "acct-1");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
  });

  it("differs per account", async () => {
    const [a] = await computeDedupeKeys([row], "acct-1");
    const [b] = await computeDedupeKeys([row], "acct-2");
    expect(a).not.toBe(b);
  });

  it("numbers identical rows so neither is dropped", () => {
    expect(dedupeMaterial([row, row], "acct-1")).toEqual([
      "savings-v1|acct-1|2025-08-01|expense|2100|105330",
      "savings-v1|acct-1|2025-08-01|expense|2100|105330|#2",
    ]);
  });
});
