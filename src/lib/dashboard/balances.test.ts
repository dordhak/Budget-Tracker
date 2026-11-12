import { describe, expect, it } from "vitest";
import { periodBalance } from "./balances";

describe("periodBalance", () => {
  it("follows the running-balance chain regardless of row order", () => {
    // August sample: opens 1,074.30; three rows on the same day, shuffled.
    const rows = [
      { date: "2025-08-01", type: "income" as const, amount: "550.00", balance: "2103.30" },
      { date: "2025-08-01", type: "expense" as const, amount: "21.00", balance: "1053.30" },
      { date: "2025-08-01", type: "income" as const, amount: "500.00", balance: "1553.30" },
    ];
    expect(periodBalance(rows)).toEqual({ openingCents: 107430, closingCents: 210330, exact: true });
  });

  it("handles a debit, its refund and the same debit again", () => {
    const rows = [
      { date: "2025-08-16", type: "expense" as const, amount: 4.41, balance: 3032.3 },
      { date: "2025-08-16", type: "income" as const, amount: 4.41, balance: 3036.71 },
      { date: "2025-08-17", type: "expense" as const, amount: 4.41, balance: 3032.3 },
    ];
    expect(periodBalance(rows)).toEqual({ openingCents: 303671, closingCents: 303230, exact: true });
  });

  it("falls back to date order when the chain has a gap", () => {
    const rows = [
      { date: "2025-08-01", type: "expense" as const, amount: 10, balance: 90 },
      { date: "2025-08-05", type: "expense" as const, amount: 10, balance: 50 }, // a row between is missing
    ];
    expect(periodBalance(rows)).toEqual({ openingCents: 10000, closingCents: 5000, exact: false });
  });

  it("returns null without balances", () => {
    expect(periodBalance([{ date: "2025-08-01", type: "expense", amount: 1, balance: null }])).toBeNull();
    expect(periodBalance([])).toBeNull();
  });
});
