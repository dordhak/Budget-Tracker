import { describe, expect, it } from "vitest";
import { budgetProgress, parseCategory, parseMoney, sumLimits } from "./budget";

describe("budgetProgress", () => {
  it("reports unset for missing, zero or negative limits", () => {
    for (const limit of [null, undefined, 0, -50, Number.NaN]) {
      expect(budgetProgress(100, limit)).toEqual({ status: "unset", percent: 0, rawPercent: null, remaining: null });
    }
  });

  it("is ok below the warning threshold", () => {
    expect(budgetProgress(250, 1000)).toEqual({ status: "ok", percent: 25, rawPercent: 25, remaining: 750 });
  });

  it("warns from 80% up to the limit", () => {
    expect(budgetProgress(800, 1000).status).toBe("warning");
    expect(budgetProgress(1000, 1000)).toMatchObject({ status: "warning", percent: 100, remaining: 0 });
  });

  it("clamps the bar but keeps the real overspend", () => {
    expect(budgetProgress(1350, 1000)).toEqual({ status: "over", percent: 100, rawPercent: 135, remaining: -350 });
  });

  it("treats negative or invalid spending as zero", () => {
    expect(budgetProgress(-20, 100)).toMatchObject({ status: "ok", percent: 0, remaining: 100 });
    expect(budgetProgress(Number.NaN, 100)).toMatchObject({ percent: 0 });
  });

  it("avoids floating point noise in remaining", () => {
    expect(budgetProgress(0.1 + 0.2, 1).remaining).toBe(0.7);
  });
});

describe("sumLimits", () => {
  it("adds numeric and string limits (PostgREST numeric)", () => {
    expect(sumLimits([{ monthly_limit: 300 }, { monthly_limit: "150.50" }, { monthly_limit: 0.1 }])).toBe(450.6);
  });

  it("is 0 for no budgets", () => {
    expect(sumLimits([])).toBe(0);
  });
});

describe("parseMoney", () => {
  it.each([
    ["1500", 1500],
    ["1,500.50", 1500.5],
    ["RM 250", 250],
    ["0", 0],
    [42, 42],
  ])("parses %s", (input, expected) => {
    expect(parseMoney(input)).toBe(expected);
  });

  it.each(["", "abc", "-5", "1.234", "1e5", "20000000", null, undefined])("rejects %s", (input) => {
    expect(parseMoney(input)).toBeNull();
  });
});

describe("parseCategory", () => {
  it("trims and collapses whitespace", () => {
    expect(parseCategory("  Food   & Drinks ")).toBe("Food & Drinks");
  });

  it("rejects empty or too long names", () => {
    expect(parseCategory("   ")).toBeNull();
    expect(parseCategory("x".repeat(61))).toBeNull();
    expect(parseCategory(5)).toBeNull();
  });
});
