import { describe, expect, it } from "vitest";
import { escapeLike, parseTransactionUpdate, suggestKeyword } from "./transaction-update";

const form = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe("parseTransactionUpdate", () => {
  it("normalizes category and notes", () => {
    expect(parseTransactionUpdate(form({ category: "  Food ", notes: "  lunch\r\nwith team  " }))).toEqual({
      category: "Food",
      notes: "lunch\nwith team",
      rule: null,
    });
  });

  it("stores empty notes as null", () => {
    expect(parseTransactionUpdate(form({ category: "Food", notes: "   " }))).toMatchObject({ notes: null });
  });

  it("requires a category", () => {
    expect(parseTransactionUpdate(form({ category: " " }))).toMatchObject({ field: "category" });
  });

  it("limits notes", () => {
    expect(parseTransactionUpdate(form({ category: "Food", notes: "x".repeat(2001) }))).toMatchObject({ field: "notes" });
  });

  it("builds a rule only when asked", () => {
    expect(parseTransactionUpdate(form({ category: "Food", keyword: "FOODPANDA" }))).toMatchObject({ rule: null });
    expect(parseTransactionUpdate(form({ category: "Food", save_rule: "on", keyword: "  food  panda " }))).toMatchObject({
      rule: { keyword: "food panda", category: "Food" },
    });
  });

  it("validates the rule keyword", () => {
    expect(parseTransactionUpdate(form({ category: "Food", save_rule: "on", keyword: "x" }))).toMatchObject({
      field: "keyword",
    });
  });
});

describe("escapeLike", () => {
  it("escapes wildcards and backslashes", () => {
    expect(escapeLike("50%_off\\")).toBe("50\\%\\_off\\\\");
  });
});

describe("suggestKeyword", () => {
  it.each([
    ["99 SPEEDMART-2592", "99 SPEEDMART"],
    ["KK SUPER MART-EPM", "KK SUPER MART"],
    ["GRAB RIDES-EC", "GRAB RIDES"],
    ["TNG-EWALLET ECOM 2", "TNG-EWALLET ECOM"],
    ["Foodpanda Malaysia", "FOODPANDA MALAYSIA"],
    ["APU-BILABILA RETAIL", "APU-BILABILA RETAIL"],
    ["AB-12", "AB"],
  ])("%s -> %s", (merchant, expected) => {
    expect(suggestKeyword(merchant)).toBe(expected);
  });

  it("is empty without a merchant", () => {
    expect(suggestKeyword(null)).toBe("");
  });
});
