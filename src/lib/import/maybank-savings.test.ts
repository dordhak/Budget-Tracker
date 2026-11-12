import { describe, expect, it } from "vitest";
import { detectParser } from "./index";
import { parseMaybankSavings } from "./maybank-savings";
import { augustStatementItems } from "./__fixtures__/maybank-aug-2025";
import { buildStatement, r, shuffled } from "./__fixtures__/statement-builder";

const SD = "SALE DEBIT";

describe("Maybank savings parser: August 2025 statement", () => {
  const items = augustStatementItems();
  const result = parseMaybankSavings(items);
  const tx = result.transactions;

  it("is detected as a Maybank savings statement", () => {
    expect(detectParser(items)?.id).toBe("maybank-savings");
  });

  it("reads statement metadata and every row", () => {
    expect(result.statementDate).toBe("2025-08-31");
    expect(result.openingBalanceCents).toBe(107430);
    expect(result.closingBalanceCents).toBe(345156);
    expect(result.totalCreditCents).toBe(442388);
    expect(result.totalDebitCents).toBe(204662);
    expect(tx).toHaveLength(91);
    expect(tx.map((t) => t.page).at(-1)).toBe(9);
  });

  it("passes every checksum against the summary block", () => {
    expect(result.checks.map((c) => [c.id, c.ok])).toEqual([
      ["credits", true],
      ["debits", true],
      ["closing", true],
      ["equation", true],
    ]);
  });

  it("validates every row against the running balance", () => {
    const bad = tx.filter((t) => t.flags.includes("balance_mismatch") || t.flags.includes("sign_mismatch"));
    expect(bad).toEqual([]);
  });

  it("drops headers, footers and the beginning balance line", () => {
    const text = tx.map((t) => t.description).join(" ");
    for (const junk of ["STATEMENT BALANCE", "CUSTOMER NAME", "Perhation", "BEGINNING BALANCE", "PIDM", "TOTAL CREDIT"]) {
      expect(text).not.toContain(junk);
    }
  });

  it("normalizes trailing signs and thousands separators", () => {
    expect(tx[0]).toMatchObject({ date: "2025-08-01", amount: 21, amountCents: 2100, type: "expense", balance: 1053.3 });
    const wise = tx.find((t) => t.amountCents === 209047)!;
    expect(wise).toMatchObject({ type: "income", balanceCents: 348166 });
  });

  it("takes the type from the balance, not the wording ('TFR TO A/C' is a credit here)", () => {
    const wise = tx.find((t) => t.amountCents === 209047)!;
    expect(wise.description).toContain("IBK FUND TFR TO A/C");
    expect(wise.type).toBe("income");
  });

  it("maps PRE-AUTH REFUND to income", () => {
    const refund = tx.find((t) => t.description.startsWith("PRE-AUTH REFUND"))!;
    expect(refund).toMatchObject({ type: "income", amountCents: 441 });
  });

  it("stitches descriptions across a page break (page 1 -> 2)", () => {
    const kk = tx.find((t) => t.date === "2025-08-03" && t.amountCents === 350)!;
    expect(kk.page).toBe(1);
    expect(kk.description).toBe("SALE DEBIT KK SUPER MART-EPM * KUALA LUMPUR, MY");
    expect(kk.merchant).toBe("KK SUPER MART-EPM");
    expect(kk.flags).toEqual([]);
  });

  it("stitches three continuation lines onto the last row of page 3", () => {
    const butcher = tx.find((t) => t.date === "2025-08-13" && t.amountCents === 3000)!;
    expect(butcher.description).toBe("IBK FUND TFR FR A/C DAILY BUTCHER ENT * 70348897 DUITNOW QR");
    expect(butcher.merchant).toBe("DAILY BUTCHER ENT");
  });

  it("extracts merchants and skips location-only lines", () => {
    expect(tx.find((t) => t.amountCents === 1890)!.merchant).toBe("Kaiflex Sdn. Bhd.");
    expect(tx.find((t) => t.amountCents === 1000)!.merchant).toBe("TNG-EWALLET ECOM 2");
    const noMerchant = tx.find((t) => t.date === "2025-08-07")!;
    expect(noMerchant.merchant).toBeNull();
    expect(noMerchant.description).toBe("SALE DEBIT Kuala Lumpur, MY");
  });

  describe("page 9 (reflowed descriptions)", () => {
    const page9 = tx.filter((t) => t.page === 9);

    it("keeps exact amounts and balances", () => {
      expect(page9.map((t) => [t.date, t.amountCents, t.type, t.balanceCents])).toEqual([
        ["2025-08-29", 840, "expense", 354564],
        ["2025-08-29", 1600, "income", 356164],
        ["2025-08-29", 2119, "expense", 354045],
        ["2025-08-30", 900, "expense", 353145],
        ["2025-08-30", 4200, "expense", 348945],
        ["2025-08-30", 1590, "expense", 347355],
        ["2025-08-31", 2199, "expense", 345156],
      ]);
    });

    it("re-assembles descriptions in order and flags them for review", () => {
      expect(page9.every((t) => t.flags.includes("description_reconstructed"))).toBe(true);
      expect(page9.map((t) => t.merchant)).toEqual([
        "APU-BILABILA RETAIL",
        null,
        "Foodpanda Malaysia",
        null,
        "McDonalds 1010338",
        "99 SPEEDMART-2592",
        "Foodpanda Malaysia",
      ]);
      expect(page9[1].description).toBe("REFUND SALE GRAB RIDES-EC PETALING JAYA, MY");
      expect(page9[3].description).toBe("SALE DEBIT GRAB RIDES-EC PETALING JAYA, MY");
      expect(result.warnings.some((w) => w.startsWith("Page 9: descriptions were reflowed"))).toBe(true);
    });

    it("gives the leading end marker back to the last row of page 8", () => {
      const last8 = tx.filter((t) => t.page === 8).at(-1)!;
      expect(last8.description).toBe("SALE DEBIT GRAB RIDES-EC * PETALING JAYA, MY");
      expect(last8.flags).toEqual([]);
    });

    it("does not flag rows on normal pages", () => {
      expect(tx.filter((t) => t.page < 9 && t.flags.length > 0)).toEqual([]);
    });
  });

  it("ignores the order pdfjs returns items in", () => {
    const fromShuffled = parseMaybankSavings(shuffled(items));
    expect(fromShuffled.transactions).toEqual(tx);
  });
});

describe("Maybank savings parser: edge cases", () => {
  const base = { statementDate: "31/08/25", opening: "100.00", summary: true };

  it("flags a trailing sign that disagrees with the balance and trusts the balance", () => {
    const items = buildStatement({
      ...base,
      rows: [{ date: "01/08/25", amount: "10.00-", balance: "110.00", lines: [SD, "SHOP *", "KL, MY", SD] }],
    });
    const [t] = parseMaybankSavings(items).transactions;
    expect(t.type).toBe("income");
    expect(t.flags).toContain("sign_mismatch");
  });

  it("flags an amount that doesn't match the balance change and falls back to the sign", () => {
    const items = buildStatement({
      ...base,
      rows: [{ date: "01/08/25", amount: "10.00-", balance: "95.00", lines: [SD, "SHOP *", "KL, MY", SD] }],
    });
    const [t] = parseMaybankSavings(items).transactions;
    expect(t.type).toBe("expense");
    expect(t.flags).toContain("balance_mismatch");
  });

  it("maps a month-end profit (hibah) credit to income", () => {
    const items = buildStatement({
      ...base,
      rows: [r("31/08/25", "1.23+", "PROFIT PAID", "HIBAH AUG 2025")],
    });
    const result = parseMaybankSavings(items);
    expect(result.transactions[0]).toMatchObject({ type: "income", amountCents: 123, flags: [] });
    expect(result.checks.every((c) => c.ok)).toBe(true);
  });

  it("handles a failed payment and its reversal a few rows later", () => {
    const items = buildStatement({
      ...base,
      rows: [
        r("05/08/25", "50.00-", SD, "ONLINE STORE *", "KUALA LUMPUR, MY", SD),
        r("05/08/25", "3.00-", SD, "COFFEE *", "KUALA LUMPUR, MY", SD),
        r("06/08/25", "50.00+", "REVERSAL", "ONLINE STORE *", "KUALA LUMPUR, MY"),
      ],
    });
    const { transactions, checks } = parseMaybankSavings(items);
    expect(transactions.map((t) => [t.type, t.amountCents])).toEqual([
      ["expense", 5000],
      ["expense", 300],
      ["income", 5000],
    ]);
    expect(transactions[2].merchant).toBe("ONLINE STORE");
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("appends a foreign currency line to the description instead of making a new row", () => {
    const items = buildStatement({
      ...base,
      rows: [
        r("10/08/25", "45.20-", SD, "NETFLIX.COM *", "LOS GATOS, US", "USD 10.00 @ 4.5200", SD),
        r("11/08/25", "5.00-", SD, "KK SUPER MART *", "KUALA LUMPUR, MY", SD),
      ],
    });
    const { transactions, warnings } = parseMaybankSavings(items);
    expect(transactions).toHaveLength(2);
    expect(transactions[0].description).toBe("SALE DEBIT NETFLIX.COM * LOS GATOS, US USD 10.00 @ 4.5200");
    expect(transactions[0].merchant).toBe("NETFLIX.COM");
    expect(warnings).toEqual([]);
  });

  it("parses 4-digit years and infers a missing year from the statement date", () => {
    const items = buildStatement({
      statementDate: "05/01/26",
      opening: "100.00",
      summary: true,
      rows: [
        r("28/12", "1.00-", SD, "SHOP *", "KL, MY", SD),
        r("02/01/2026", "1.00-", SD, "SHOP *", "KL, MY", SD),
      ],
    });
    const [dec, jan] = parseMaybankSavings(items).transactions;
    expect(dec).toMatchObject({ date: "2025-12-28" });
    expect(dec.flags).toContain("date_inferred");
    expect(jan).toMatchObject({ date: "2026-01-02", flags: [] });
  });

  it("flags dates after the statement date", () => {
    const items = buildStatement({ ...base, rows: [r("02/09/25", "1.00-", SD, "SHOP *", "KL, MY", SD)] });
    expect(parseMaybankSavings(items).transactions[0].flags).toContain("date_out_of_range");
  });

  it("flags rows whose type it doesn't know instead of guessing a split", () => {
    const items = buildStatement({
      ...base,
      rows: [
        r("01/08/25", "5.00-", "MYSTERY TXN TYPE", "SOMEONE", "REF 123"),
        r("02/08/25", "1.00-", SD, "SHOP *", "KL, MY", SD),
      ],
    });
    const { transactions } = parseMaybankSavings(items);
    expect(transactions[0].flags).toContain("description_unaligned");
    expect(transactions[0].description).toBe("MYSTERY TXN TYPE SOMEONE REF 123");
    expect(transactions[1].flags).toEqual([]);
  });

  it("reports unknown checks when the summary block is missing", () => {
    const items = buildStatement({ ...base, summary: false, rows: [r("01/08/25", "1.00-", SD, "SHOP *", "KL, MY", SD)] });
    const result = parseMaybankSavings(items);
    expect(result.checks.map((c) => c.ok)).toEqual([null, null, null, null]);
    expect(result.warnings).toContain("ENDING BALANCE line not found; the statement may be incomplete.");
  });

  it("is not detected for unrelated PDFs", () => {
    expect(detectParser([{ page: 1, x: 0, y: 0, str: "Some other bank statement" }])).toBeNull();
  });
});
