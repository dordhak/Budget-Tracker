import { describe, expect, it } from "vitest";
import { daysOfMonth, isMonth, lastMonths, monthBounds, monthLabel, monthOf, monthShort, shiftMonth } from "./month";

describe("month helpers", () => {
  it("validates YYYY-MM", () => {
    expect(isMonth("2025-08")).toBe(true);
    expect(isMonth("2025-13")).toBe(false);
    expect(isMonth("2025-8")).toBe(false);
    expect(isMonth(202508)).toBe(false);
  });

  it("finds month bounds, including leap years", () => {
    expect(monthBounds("2025-08")).toEqual({ from: "2025-08-01", to: "2025-08-31" });
    expect(monthBounds("2024-02")).toEqual({ from: "2024-02-01", to: "2024-02-29" });
    expect(monthBounds("2025-02").to).toBe("2025-02-28");
  });

  it("shifts across year boundaries", () => {
    expect(shiftMonth("2025-01", -1)).toBe("2024-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
    expect(lastMonths("2025-02", 3)).toEqual(["2024-12", "2025-01", "2025-02"]);
  });

  it("labels months", () => {
    expect(monthOf("2025-08-14")).toBe("2025-08");
    expect(monthLabel("2025-08")).toBe("August 2025");
    expect(monthShort("2025-08")).toBe("Aug");
  });

  it("lists the days of a month, optionally up to today", () => {
    expect(daysOfMonth("2025-02")).toHaveLength(28);
    expect(daysOfMonth("2025-08", "2025-08-03")).toEqual(["2025-08-01", "2025-08-02", "2025-08-03"]);
    expect(daysOfMonth("2025-08", "2025-09-10")).toHaveLength(31);
  });
});
