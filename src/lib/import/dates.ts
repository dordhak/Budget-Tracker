// Statement date parsing. Maybank uses DD/MM/YY; DD/MM/YYYY and DD/MM are tolerated.

export const DATE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2}|\d{4}))?$/;

export interface ParsedDate {
  iso: string; // YYYY-MM-DD
  inferredYear: boolean;
}

function toIso(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  // Reject rollovers such as 31/02.
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * @param reference ISO statement date, used when the year is missing.
 *   A month later than the statement month belongs to the previous year
 *   (e.g. "28/12" on a statement dated 05/01/26 is 2025-12-28).
 */
export function parseStatementDate(text: string, reference?: string | null): ParsedDate | null {
  const match = DATE_RE.exec(text.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);

  if (match[3]) {
    const year = match[3].length === 2 ? 2000 + Number(match[3]) : Number(match[3]);
    const iso = toIso(year, month, day);
    return iso ? { iso, inferredYear: false } : null;
  }

  if (!reference) return null;
  const refYear = Number(reference.slice(0, 4));
  const refMonth = Number(reference.slice(5, 7));
  const year = month > refMonth ? refYear - 1 : refYear;
  const iso = toIso(year, month, day);
  return iso ? { iso, inferredYear: true } : null;
}

/** Whole days from a to b (ISO dates). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
