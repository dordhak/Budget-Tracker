import type { TextItem } from "./types";

export interface Line {
  page: number;
  /** y of the first item that opened the line. */
  y: number;
  /** Items left to right. */
  items: TextItem[];
}

/** Items closer than this vertically are on the same line (rows are 12 units apart; date vs text drift is ~0.4). */
export const LINE_TOLERANCE = 3;

/** NFKC folds look-alike glyphs (e.g. Kangxi radicals in the header) and collapses whitespace. */
export function normalizeText(text: string): string {
  return text.normalize("NFKC").replace(/\s+/g, " ").trim();
}

/**
 * Groups one page's items into lines, top to bottom.
 * pdfjs returns text in drawing order (often column by column), so order is ignored.
 */
export function groupLines(items: ReadonlyArray<TextItem>): Line[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const lines: Line[] = [];

  for (const item of sorted) {
    const current = lines[lines.length - 1];
    if (current && current.page === item.page && Math.abs(current.y - item.y) <= LINE_TOLERANCE) {
      current.items.push(item);
    } else {
      lines.push({ page: item.page, y: item.y, items: [item] });
    }
  }
  for (const line of lines) line.items.sort((a, b) => a.x - b.x);
  return lines;
}

export function joinText(items: ReadonlyArray<TextItem>): string {
  return normalizeText(items.map((i) => i.str).join(" "));
}
