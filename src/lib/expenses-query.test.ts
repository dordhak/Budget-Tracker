import { describe, expect, it } from "vitest";
import {
  expensesHref,
  pageCount,
  pageRange,
  parseExpenseParams,
  sanitizeSearch,
  visiblePages,
} from "./expenses-query";

describe("sanitizeSearch", () => {
  it("keeps normal merchant text", () => {
    expect(sanitizeSearch("  99 Speedmart-2592  ")).toBe("99 Speedmart-2592");
    expect(sanitizeSearch("APPLE.COM/BILL")).toBe("APPLE.COM/BILL");
  });

  it("strips PostgREST syntax and LIKE wildcards", () => {
    expect(sanitizeSearch('grab,description.eq.x)(%_"\\')).toBe("grab description.eq.x");
    expect(sanitizeSearch("GRAB RIDES-EC *")).toBe("GRAB RIDES-EC");
  });

  it("caps the length", () => {
    expect(sanitizeSearch("a".repeat(500))).toHaveLength(100);
  });
});

describe("parseExpenseParams", () => {
  it("defaults missing values", () => {
    expect(parseExpenseParams({})).toEqual({ q: "", category: "", page: 1 });
  });

  it("reads the first value of repeated params", () => {
    expect(parseExpenseParams({ q: ["grab", "x"], category: " Food ", page: "3" })).toEqual({
      q: "grab",
      category: "Food",
      page: 3,
    });
  });

  it.each(["0", "-2", "abc", ""])("falls back to page 1 for %j", (page) => {
    expect(parseExpenseParams({ page }).page).toBe(1);
  });

  it("caps absurd page numbers", () => {
    expect(parseExpenseParams({ page: "99999999" }).page).toBe(10_000);
  });
});

describe("expensesHref", () => {
  const current = { q: "grab", category: "Transport", page: 3 };

  it("omits defaults", () => {
    expect(expensesHref({ q: "", category: "", page: 1 })).toBe("/expenses");
  });

  it("changes page and keeps filters", () => {
    expect(expensesHref(current, { page: 4 })).toBe("/expenses?q=grab&category=Transport&page=4");
  });

  it("resets to page 1 when filters change", () => {
    expect(expensesHref(current, { q: "foodpanda" })).toBe("/expenses?q=foodpanda&category=Transport");
    expect(expensesHref(current, { category: "" })).toBe("/expenses?q=grab");
  });

  it("encodes special characters", () => {
    expect(expensesHref({ q: "", category: "Food & Drinks", page: 1 })).toBe("/expenses?category=Food+%26+Drinks");
  });
});

describe("pagination helpers", () => {
  it("counts pages", () => {
    expect(pageCount(0)).toBe(1);
    expect(pageCount(20)).toBe(1);
    expect(pageCount(21)).toBe(2);
  });

  it("returns inclusive ranges", () => {
    expect(pageRange(1)).toEqual([0, 19]);
    expect(pageRange(3)).toEqual([40, 59]);
  });

  it("shows every page when there are few", () => {
    expect(visiblePages(2, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("collapses long ranges", () => {
    expect(visiblePages(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(visiblePages(1, 12)).toEqual([1, 2, "…", 12]);
    expect(visiblePages(12, 12)).toEqual([1, "…", 11, 12]);
  });
});
