import { describe, expect, it } from "vitest";
import { isOwnReceiptPath, parseEntryForm, todayIso } from "./validate-entry";

const USER = "11111111-2222-3333-4444-555555555555";
const FILE = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const TODAY = "2025-09-15";

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });
const good = { type: "expense", amount: "20.10", date: "2025-09-14", category: " Groceries ", merchant: " 99  SPEEDMART ", notes: "" };
const parse = (patch: Record<string, string> = {}) => parseEntryForm(form({ ...good, ...patch }), USER, TODAY);

describe("parseEntryForm", () => {
  it("accepts and normalizes a manual entry", () => {
    expect(parse()).toEqual({
      date: "2025-09-14",
      amount: 20.1,
      type: "expense",
      category: "Groceries",
      merchant: "99 SPEEDMART",
      notes: null,
      payment_method: "bank",
      source: "manual",
      receipt_path: null,
    });
  });

  it("defaults an empty category and accepts cash income", () => {
    expect(parse({ category: "", type: "income", payment_method: "cash" })).toMatchObject({
      category: "Uncategorized",
      type: "income",
      payment_method: "cash",
    });
  });

  it("accepts a receipt in the user's own folder", () => {
    expect(parse({ receipt_path: `${USER}/${FILE}.jpg`, source: "receipt_image" })).toMatchObject({
      receipt_path: `${USER}/${FILE}.jpg`,
      source: "receipt_image",
    });
  });

  it.each([
    [{ type: "transfer" }, "type"],
    [{ amount: "0" }, "amount"],
    [{ amount: "-3" }, "amount"],
    [{ amount: "1.234" }, "amount"],
    [{ date: "2025-02-30" }, "date"],
    [{ date: "15/09/2025" }, "date"],
    [{ date: "2025-09-20" }, "date"],
    [{ date: "2014-01-01" }, "date"],
    [{ payment_method: "card" }, "payment_method"],
    [{ category: "c".repeat(61) }, "category"],
    [{ merchant: "m".repeat(121) }, "merchant"],
    [{ notes: "n".repeat(2001) }, "notes"],
    [{ receipt_path: `someone-else/${FILE}.jpg` }, "receipt"],
    [{ receipt_path: `${USER}/../x.jpg` }, "receipt"],
    [{ source: "scanner" }, "receipt"],
  ])("rejects %o", (patch, field) => {
    expect(parse(patch)).toMatchObject({ field });
  });

  it("allows tomorrow (timezone edge) but not later", () => {
    expect(parse({ date: "2025-09-16" })).toMatchObject({ date: "2025-09-16" });
    expect(parse({ date: "2025-09-17" })).toMatchObject({ field: "date" });
  });
});

describe("isOwnReceiptPath", () => {
  it("only allows generated names in the user's folder", () => {
    expect(isOwnReceiptPath(`${USER}/${FILE}.pdf`, USER)).toBe(true);
    expect(isOwnReceiptPath(`${USER}/${FILE}.exe`, USER)).toBe(false);
    expect(isOwnReceiptPath(`${USER}/nested/${FILE}.jpg`, USER)).toBe(false);
  });
});

describe("todayIso", () => {
  it("uses Malaysia time", () => {
    // 2025-09-15 20:00 UTC is already the 16th in Kuala Lumpur (UTC+8).
    expect(todayIso("Asia/Kuala_Lumpur", new Date("2025-09-15T20:00:00Z"))).toBe("2025-09-16");
  });
});
