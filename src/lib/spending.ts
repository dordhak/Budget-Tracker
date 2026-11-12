// Pure helpers for the 30-day spending chart (unit tested, no React).

export interface DailySpendingRow {
  day: string; // "YYYY-MM-DD" from Postgres `date`
  total: number | string; // PostgREST may send numeric as string
}

export interface SpendingPoint {
  day: string; // ISO date, used as the stable key
  label: string; // "12 Nov"
  total: number;
}

export interface SpendingSummary {
  points: SpendingPoint[];
  total: number;
  average: number;
  peak: SpendingPoint | null;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-11-05" -> "5 Nov". Parsed by hand so the server/browser timezone can't shift the day. */
export function shortDayLabel(isoDay: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDay);
  if (!match) return isoDay;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${Number(match[3])} ${month}` : isoDay;
}

export function summarizeSpending(rows: ReadonlyArray<DailySpendingRow> | null | undefined): SpendingSummary {
  const points = [...(rows ?? [])]
    .filter((r) => typeof r.day === "string")
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((r) => {
      const total = Number(r.total);
      return {
        day: r.day,
        label: shortDayLabel(r.day),
        total: Number.isFinite(total) && total > 0 ? Math.round(total * 100) / 100 : 0,
      };
    });

  const total = Math.round(points.reduce((sum, p) => sum + p.total, 0) * 100) / 100;
  const average = points.length ? Math.round((total / points.length) * 100) / 100 : 0;
  const peak = points.reduce<SpendingPoint | null>(
    (best, p) => (p.total > 0 && (!best || p.total > best.total) ? p : best),
    null,
  );

  return { points, total, average, peak };
}
