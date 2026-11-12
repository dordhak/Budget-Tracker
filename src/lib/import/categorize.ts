export const UNCATEGORIZED = "Uncategorized";

export interface CategoryRule {
  keyword: string;
  category: string;
  /** Lower wins. Ties go to the longer (more specific) keyword. */
  priority: number;
}

const norm = (s: string) => s.toUpperCase().replace(/\s+/g, " ").trim();

/** Case-insensitive substring match of rule keywords against merchant + description. */
export function categorize(
  tx: { description: string; merchant: string | null },
  rules: ReadonlyArray<CategoryRule>,
): string {
  const haystack = norm(`${tx.merchant ?? ""} ${tx.description}`);
  let best: CategoryRule | null = null;

  for (const rule of rules) {
    const keyword = norm(rule.keyword);
    if (!keyword || !haystack.includes(keyword)) continue;
    if (
      !best ||
      rule.priority < best.priority ||
      (rule.priority === best.priority && keyword.length > norm(best.keyword).length)
    ) {
      best = rule;
    }
  }
  return best?.category ?? UNCATEGORIZED;
}
