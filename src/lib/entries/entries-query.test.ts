import { describe, expect, it } from "vitest";
import { entriesHref, entryMatchState, parseEntryParams } from "./entries-query";

describe("parseEntryParams", () => {
  it("defaults everything", () => {
    expect(parseEntryParams({})).toEqual({ q: "", month: "", type: "", status: "", page: 1 });
  });

  it("reads valid values and drops invalid ones", () => {
    expect(parseEntryParams({ q: "grab,%", month: "2025-08", type: "income", status: "awaiting", page: "2" })).toEqual({
      q: "grab",
      month: "2025-08",
      type: "income",
      status: "awaiting",
      page: 2,
    });
    expect(parseEntryParams({ month: "2025-13", type: "transfer", status: "x", page: "-1" })).toEqual({
      q: "",
      month: "",
      type: "",
      status: "",
      page: 1,
    });
  });
});

describe("entriesHref", () => {
  const p = { q: "", month: "2025-08", type: "expense" as const, status: "" as const, page: 3 };

  it("keeps filters when paging", () => {
    expect(entriesHref(p, { page: 4 })).toBe("/entries?month=2025-08&type=expense&page=4");
  });

  it("resets the page when a filter changes", () => {
    expect(entriesHref(p, { status: "cash" })).toBe("/entries?month=2025-08&type=expense&status=cash");
    expect(entriesHref(p, { month: "" })).toBe("/entries?type=expense");
  });

  it("omits defaults", () => {
    expect(entriesHref({ q: "", month: "", type: "", status: "", page: 1 })).toBe("/entries");
  });
});

describe("entryMatchState", () => {
  it("classifies entries", () => {
    expect(entryMatchState({ payment_method: "cash", transaction_id: null })).toBe("cash");
    expect(entryMatchState({ payment_method: "bank", transaction_id: null })).toBe("awaiting");
    expect(entryMatchState({ payment_method: "bank", transaction_id: "t" })).toBe("matched");
  });
});
