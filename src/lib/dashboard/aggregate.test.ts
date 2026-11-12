import { describe, expect, it } from "vitest";
import {
  budgetItems,
  categoryBreakdown,
  dailySeries,
  entryStatus,
  monthlySeries,
  monthTotals,
  statementItems,
  type EntryLike,
  type Item,
  type TransactionLike,
} from "./aggregate";

const entry = (p: Partial<EntryLike> & Pick<EntryLike, "id" | "date" | "amount">): EntryLike => ({
  type: "expense",
  category: "Food",
  payment_method: "bank",
  transaction_id: null,
  ...p,
});
const tx = (p: Partial<TransactionLike> & Pick<TransactionLike, "id" | "date" | "amount">): TransactionLike => ({
  type: "expense",
  category: "Uncategorized",
  ...p,
});

describe("budgetItems", () => {
  it("counts a matched pair once, using the entry's category", () => {
    const items = budgetItems(
      [entry({ id: "e1", date: "2025-08-03", amount: 3.5, category: "Groceries", transaction_id: "t1" })],
      [tx({ id: "t1", date: "2025-08-04", amount: "3.50", category: "Uncategorized" }), tx({ id: "t2", date: "2025-08-05", amount: 9 })],
    );
    expect(items).toEqual([
      { date: "2025-08-03", type: "expense", amountCents: 350, category: "Groceries" },
      { date: "2025-08-05", type: "expense", amountCents: 900, category: "Uncategorized" },
    ]);
  });

  it("excludes rows matched to entries outside the window via linkedTxIds", () => {
    const items = budgetItems([], [tx({ id: "t1", date: "2025-09-01", amount: 9 })], new Set(["t1"]));
    expect(items).toEqual([]);
  });

  it("includes cash entries and unmatched statement rows", () => {
    const items = budgetItems([entry({ id: "c", date: "2025-08-01", amount: 5, payment_method: "cash" })], [tx({ id: "t", date: "2025-08-01", amount: 5 })]);
    expect(items).toHaveLength(2);
  });

  it("statementItems keeps every bank row", () => {
    expect(statementItems([tx({ id: "t", date: "2025-08-01", amount: "1.10" })])).toEqual([
      { date: "2025-08-01", type: "expense", amountCents: 110, category: "Uncategorized" },
    ]);
  });
});

const items: Item[] = [
  { date: "2025-07-31", type: "expense", amountCents: 1000, category: "Food" },
  { date: "2025-08-01", type: "income", amountCents: 50000, category: "Salary" },
  { date: "2025-08-01", type: "expense", amountCents: 2000, category: "Food" },
  { date: "2025-08-03", type: "expense", amountCents: 1000, category: "Transport" },
  { date: "2025-08-03", type: "expense", amountCents: 500, category: "Food" },
];

describe("monthTotals", () => {
  it("sums only the month", () => {
    expect(monthTotals(items, "2025-08")).toEqual({ incomeCents: 50000, expenseCents: 3500, netCents: 46500, count: 4 });
    expect(monthTotals(items, "2025-09")).toEqual({ incomeCents: 0, expenseCents: 0, netCents: 0, count: 0 });
  });
});

describe("categoryBreakdown", () => {
  it("sorts expense categories with percentages", () => {
    expect(categoryBreakdown(items, "2025-08")).toEqual([
      { category: "Food", cents: 2500, percent: 71.4 },
      { category: "Transport", cents: 1000, percent: 28.6 },
    ]);
  });

  it("folds small categories into Other", () => {
    const many: Item[] = ["A", "B", "C", "D"].map((c, i) => ({ date: "2025-08-01", type: "expense", amountCents: (4 - i) * 100, category: c }));
    expect(categoryBreakdown(many, "2025-08", 3).map((s) => [s.category, s.cents])).toEqual([
      ["A", 400],
      ["B", 300],
      ["Other", 300],
    ]);
  });

  it("is empty without spending", () => {
    expect(categoryBreakdown(items, "2025-06")).toEqual([]);
  });
});

describe("monthlySeries", () => {
  it("zero-fills months and ignores others", () => {
    expect(monthlySeries(items, ["2025-07", "2025-08", "2025-09"])).toEqual([
      { month: "2025-07", label: "Jul", incomeCents: 0, expenseCents: 1000 },
      { month: "2025-08", label: "Aug", incomeCents: 50000, expenseCents: 3500 },
      { month: "2025-09", label: "Sep", incomeCents: 0, expenseCents: 0 },
    ]);
  });
});

describe("dailySeries", () => {
  it("zero-fills days and stops at today for the current month", () => {
    expect(dailySeries(items, "2025-08", "2025-08-03")).toEqual([
      { day: "2025-08-01", label: "1", cents: 2000 },
      { day: "2025-08-02", label: "2", cents: 0 },
      { day: "2025-08-03", label: "3", cents: 1500 },
    ]);
    expect(dailySeries(items, "2025-08")).toHaveLength(31);
  });
});

describe("entryStatus", () => {
  const entries = [
    entry({ id: "a", date: "2025-08-10", amount: 1 }),
    entry({ id: "b", date: "2025-08-29", amount: 1 }),
    entry({ id: "c", date: "2025-08-12", amount: 1, transaction_id: "t" }),
    entry({ id: "d", date: "2025-08-12", amount: 1, payment_method: "cash" }),
    entry({ id: "e", date: "2025-07-12", amount: 1 }),
  ];

  it("splits unmatched bank entries by statement coverage", () => {
    // Statement imported up to 31 Aug: anything on/before 28 Aug should have been on it.
    expect(entryStatus(entries, "2025-08", "2025-08-31")).toEqual({ awaiting: 1, notOnStatement: 1 });
  });

  it("treats everything as awaiting before any statement", () => {
    expect(entryStatus(entries, "2025-08", null)).toEqual({ awaiting: 2, notOnStatement: 0 });
  });
});
