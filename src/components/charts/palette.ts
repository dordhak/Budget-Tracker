// Categorical colours chosen to stay distinguishable for common colour-vision deficiencies.
// The legend always shows names and values too, so colour is never the only cue.
export const CATEGORY_COLORS = ["#2dd4bf", "#60a5fa", "#a78bfa", "#fbbf24", "#f472b6", "#34d399", "#fb923c", "#94a3b8"];

export const INCOME_COLOR = "#2dd4bf";
export const EXPENSE_COLOR = "#60a5fa";

/**
 * Draw-in animation settings for Recharts series. Skipped for users who prefer reduced motion.
 * Charts only mount client-side (ResponsiveContainer measures first), so reading matchMedia here is safe.
 */
export function chartMotion(delay = 150) {
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return {
    isAnimationActive: !reduce,
    animationBegin: delay,
    animationDuration: 1100,
    animationEasing: "ease-out" as const,
  };
}

/** Shared Recharts tooltip look for the dark theme. */
export const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--foreground))",
  fontSize: 12,
} as const;

export const compactMYR = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  notation: "compact",
  maximumFractionDigits: 1,
});
