import { describe, expect, it } from "vitest";
import { shortDayLabel, summarizeSpending } from "./spending";

describe("shortDayLabel", () => {
  it("formats ISO days without timezone drift", () => {
    expect(shortDayLabel("2026-11-05")).toBe("5 Nov");
    expect(shortDayLabel("2025-01-31")).toBe("31 Jan");
  });

  it("returns the input when it is not an ISO date", () => {
    expect(shortDayLabel("yesterday")).toBe("yesterday");
    expect(shortDayLabel("2025-13-01")).toBe("2025-13-01");
  });
});

describe("summarizeSpending", () => {
  it("sorts by day, coerces numeric strings and computes totals", () => {
    const s = summarizeSpending([
      { day: "2025-08-03", total: "49.20" },
      { day: "2025-08-01", total: 21 },
      { day: "2025-08-02", total: "0" },
    ]);
    expect(s.points.map((p) => p.day)).toEqual(["2025-08-01", "2025-08-02", "2025-08-03"]);
    expect(s.points[2]).toEqual({ day: "2025-08-03", label: "3 Aug", total: 49.2 });
    expect(s.total).toBe(70.2);
    expect(s.average).toBe(23.4);
    expect(s.peak?.day).toBe("2025-08-03");
  });

  it("has no peak when nothing was spent", () => {
    const s = summarizeSpending([
      { day: "2025-08-01", total: 0 },
      { day: "2025-08-02", total: 0 },
    ]);
    expect(s).toMatchObject({ total: 0, average: 0, peak: null });
  });

  it("handles empty or missing data", () => {
    expect(summarizeSpending(null)).toEqual({ points: [], total: 0, average: 0, peak: null });
  });

  it("treats invalid or negative totals as zero", () => {
    const s = summarizeSpending([
      { day: "2025-08-01", total: "abc" },
      { day: "2025-08-02", total: -5 },
    ]);
    expect(s.points.map((p) => p.total)).toEqual([0, 0]);
  });

  it("rounds away floating point noise", () => {
    const s = summarizeSpending([
      { day: "2025-08-01", total: 0.1 },
      { day: "2025-08-02", total: 0.2 },
    ]);
    expect(s.total).toBe(0.3);
  });
});
