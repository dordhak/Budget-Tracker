import { maybankSavingsParser } from "./maybank-savings";
import type { StatementParser, TextItem } from "./types";

export * from "./types";
export { categorize, UNCATEGORIZED, type CategoryRule } from "./categorize";
export { computeDedupeKeys, DEDUPE_VERSION } from "./dedupe";
export { formatCents } from "./money";

/** Registered parsers. A credit card parser can be added here later. */
export const PARSERS: readonly StatementParser[] = [maybankSavingsParser];

export function detectParser(items: ReadonlyArray<TextItem>): StatementParser | null {
  return PARSERS.find((p) => p.canParse(items)) ?? null;
}
