import { describe, expect, it } from "vitest";
import { MAX_ROWS_PER_REQUEST, validateImportRow, validateImportRows } from "./validate-import";

const KEY = "a".repeat(64);
const good = {
  date: "2025-08-01",
  amount: 21,
  type: "expense",
  category: "  Food  ",
  description: "SALE DEBIT   SHOP",
  merchant: "SHOP",
  balance: 1053.3,
  dedupe_key: KEY,
};

describe("validateImportRow", () => {
  it("accepts and normalizes a good row", () => {
    expect(validateImportRow(good)).toEqual({
      date: "2025-08-01",
      amount: 21,
      type: "expense",
      category: "Food",
      description: "SALE DEBIT SHOP",
      merchant: "SHOP",
      balance: 1053.3,
      dedupe_key: KEY,
    });
  });

  it("defaults empty categories and merchants", () => {
    expect(validateImportRow({ ...good, category: " ", merchant: null, balance: null })).toMatchObject({
      category: "Uncategorized",
      merchant: null,
      balance: null,
    });
  });

  it.each([
    [{ date: "2025-02-30" }, "invalid date"],
    [{ date: "01/08/25" }, "invalid date"],
    [{ amount: 0 }, "invalid amount"],
    [{ amount: -5 }, "invalid amount"],
    [{ amount: 1.005 }, "invalid amount"],
    [{ amount: "21" }, "invalid amount"],
    [{ type: "transfer" }, "invalid type"],
    [{ balance: Number.NaN }, "invalid balance"],
    [{ dedupe_key: "abc" }, "invalid dedupe key"],
    [{ dedupe_key: "A".repeat(64) }, "invalid dedupe key"],
  ])("rejects %o", (patch, error) => {
    expect(validateImportRow({ ...good, ...patch })).toBe(error);
  });

  it("truncates overlong text", () => {
    const row = validateImportRow({ ...good, description: "x".repeat(900), category: "c".repeat(90) });
    expect(typeof row !== "string" && row.description.length).toBe(500);
    expect(typeof row !== "string" && row.category.length).toBe(60);
  });
});

describe("validateImportRows", () => {
  it("rejects empty, oversized or non-array payloads", () => {
    expect(validateImportRows([])).toMatchObject({ ok: false });
    expect(validateImportRows("rows")).toMatchObject({ ok: false });
    const many = Array.from({ length: MAX_ROWS_PER_REQUEST + 1 }, () => good);
    expect(validateImportRows(many)).toMatchObject({ ok: false });
  });

  it("reports the first bad row", () => {
    expect(validateImportRows([good, { ...good, dedupe_key: "b".repeat(64), amount: -1 }])).toEqual({
      ok: false,
      error: "Row 2: invalid amount.",
    });
  });

  it("rejects repeated keys within one request", () => {
    expect(validateImportRows([good, good])).toMatchObject({ ok: false });
  });

  it("accepts a valid batch", () => {
    const result = validateImportRows([good, { ...good, dedupe_key: "b".repeat(64) }]);
    expect(result.ok && result.rows).toHaveLength(2);
    expect(result.ok && result.matchEntryIds).toEqual([null, null]);
  });

  describe("entry matches", () => {
    const E1 = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    const second = { ...good, dedupe_key: "b".repeat(64) };

    it("returns match ids separately from the row columns", () => {
      const result = validateImportRows([{ ...good, match_entry_id: E1 }, second]);
      expect(result).toMatchObject({ ok: true, matchEntryIds: [E1, null] });
      expect(result.ok && "match_entry_id" in result.rows[0]).toBe(false);
    });

    it("rejects malformed ids and an entry used twice", () => {
      expect(validateImportRows([{ ...good, match_entry_id: "x" }])).toEqual({ ok: false, error: "Row 1: invalid entry match." });
      expect(validateImportRows([{ ...good, match_entry_id: E1 }, { ...second, match_entry_id: E1 }])).toEqual({
        ok: false,
        error: "Row 2: an entry can only match one row.",
      });
    });
  });
});
