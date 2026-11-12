import { describe, expect, it } from "vitest";
import {
  chooseMatch,
  daysApart,
  isManuallyLinkable,
  isMatchable,
  matchRows,
  unmatchedInPeriod,
  type MatchEntry,
  type MatchRow,
} from "./match";

const row = (index: number, date: string, amountCents: number, type: "income" | "expense" = "expense"): MatchRow => ({
  index,
  date,
  amountCents,
  type,
});
const entry = (id: string, date: string, amountCents: number, type: "income" | "expense" = "expense"): MatchEntry => ({
  id,
  date,
  amountCents,
  type,
});

describe("isMatchable", () => {
  it("needs the same type, the exact amount and at most 3 days apart", () => {
    const r = row(0, "2025-08-10", 350);
    expect(isMatchable(r, entry("a", "2025-08-13", 350))).toBe(true);
    expect(isMatchable(r, entry("a", "2025-08-07", 350))).toBe(true);
    expect(isMatchable(r, entry("a", "2025-08-14", 350))).toBe(false);
    expect(isMatchable(r, entry("a", "2025-08-10", 351))).toBe(false);
    expect(isMatchable(r, entry("a", "2025-08-10", 350, "income"))).toBe(false);
  });

  it("counts days across month ends", () => {
    expect(daysApart("2025-08-30", "2025-09-02")).toBe(3);
  });
});

describe("matchRows", () => {
  it("auto-matches a unique pair", () => {
    const m = matchRows([row(0, "2025-08-03", 350), row(1, "2025-08-03", 530)], [entry("kk", "2025-08-02", 350)]);
    expect(m.get(0)).toEqual({ status: "auto", entryId: "kk", candidates: ["kk"] });
    expect(m.get(1)).toEqual({ status: "none", entryId: null, candidates: [] });
  });

  it("pre-selects the closest date when several entries fit, and asks to confirm", () => {
    const m = matchRows([row(0, "2025-08-10", 900)], [entry("far", "2025-08-07", 900), entry("near", "2025-08-09", 900)]);
    expect(m.get(0)).toEqual({ status: "suggested", entryId: "near", candidates: ["far", "near"] });
  });

  it("never uses one entry twice (two Grab rides, one logged)", () => {
    const m = matchRows([row(0, "2025-08-11", 900), row(1, "2025-08-12", 900)], [entry("grab", "2025-08-12", 900)]);
    expect(m.get(1)).toMatchObject({ status: "suggested", entryId: "grab" });
    expect(m.get(0)).toMatchObject({ status: "none", entryId: null, candidates: ["grab"] });
  });

  it("pairs two identical purchases with two entries one-to-one", () => {
    const m = matchRows(
      [row(0, "2025-08-11", 230), row(1, "2025-08-11", 230)],
      [entry("e1", "2025-08-11", 230), entry("e2", "2025-08-11", 230)],
    );
    expect([m.get(0)!.entryId, m.get(1)!.entryId]).toEqual(["e1", "e2"]);
    expect(m.get(0)!.status).toBe("suggested");
  });

  it("matches income to income only", () => {
    const m = matchRows([row(0, "2025-08-01", 50000, "income")], [entry("exp", "2025-08-01", 50000, "expense")]);
    expect(m.get(0)!.status).toBe("none");
  });
});

describe("chooseMatch", () => {
  it("moves an entry from one row to another", () => {
    const start = new Map<number, string | null>([
      [0, "grab"],
      [1, null],
    ]);
    const next = chooseMatch(start, 1, "grab");
    expect([...next]).toEqual([
      [0, null],
      [1, "grab"],
    ]);
    expect(start.get(0)).toBe("grab"); // not mutated
  });

  it("clears a row", () => {
    expect(chooseMatch(new Map([[0, "a"]]), 0, null).get(0)).toBeNull();
  });
});

describe("isManuallyLinkable", () => {
  const e = { date: "2025-08-10", type: "expense" as const, payment_method: "bank" as const };

  it("allows a different amount within a week, same type, bank only", () => {
    expect(isManuallyLinkable(e, { date: "2025-08-17", type: "expense" })).toBe(true);
    expect(isManuallyLinkable(e, { date: "2025-08-18", type: "expense" })).toBe(false);
    expect(isManuallyLinkable(e, { date: "2025-08-10", type: "income" })).toBe(false);
    expect(isManuallyLinkable({ ...e, payment_method: "cash" }, { date: "2025-08-10", type: "expense" })).toBe(false);
  });
});

describe("unmatchedInPeriod", () => {
  it("lists bank entries in the statement period that weren't matched", () => {
    const entries = [entry("a", "2025-07-31", 100), entry("b", "2025-08-05", 100), entry("c", "2025-08-20", 100)];
    expect(unmatchedInPeriod(entries, new Set(["c"]), { from: "2025-08-01", to: "2025-08-31" }).map((e) => e.id)).toEqual([
      "b",
    ]);
  });
});
