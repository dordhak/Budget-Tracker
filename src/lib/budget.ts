// Pure budget helpers (no React / Supabase) so they are easy to unit test.

export type BudgetStatus = "unset" | "ok" | "warning" | "over";

export interface BudgetProgress {
  status: BudgetStatus;
  /** 0–100, safe to feed straight into a progress bar. */
  percent: number;
  /** Unclamped, e.g. 135 when 35% over budget. null when no limit is set. */
  rawPercent: number | null;
  /** limit − spent; negative when over budget. null when no limit is set. */
  remaining: number | null;
}

/** Share of the limit at which the bar turns amber. */
export const WARNING_THRESHOLD = 80;

export function budgetProgress(spent: number, limit: number | null | undefined): BudgetProgress {
  const safeSpent = Number.isFinite(spent) && spent > 0 ? spent : 0;

  if (limit == null || !Number.isFinite(limit) || limit <= 0) {
    return { status: "unset", percent: 0, rawPercent: null, remaining: null };
  }

  const rawPercent = (safeSpent / limit) * 100;
  const status: BudgetStatus =
    safeSpent > limit ? "over" : rawPercent >= WARNING_THRESHOLD ? "warning" : "ok";

  return {
    status,
    percent: Math.min(100, Math.round(rawPercent * 10) / 10),
    rawPercent: Math.round(rawPercent * 10) / 10,
    remaining: roundMoney(limit - safeSpent),
  };
}

export function sumLimits(budgets: ReadonlyArray<{ monthly_limit: number | string }>): number {
  return roundMoney(budgets.reduce((total, b) => total + Number(b.monthly_limit || 0), 0));
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export const MAX_MONEY = 10_000_000;

/**
 * Parses a user-entered amount like "1,500" or "RM 250.50".
 * Returns null for anything invalid, negative, above MAX_MONEY or with >2 decimals.
 */
export function parseMoney(input: unknown): number | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const cleaned = String(input).trim().replace(/^RM\s*/i, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value < 0 || value > MAX_MONEY) return null;
  return value;
}

/** Trims and collapses whitespace; null if empty or longer than 60 characters. */
export function parseCategory(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim().replace(/\s+/g, " ");
  if (value.length === 0 || value.length > 60) return null;
  return value;
}
