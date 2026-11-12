// Categorical colours chosen to stay distinguishable for common colour-vision deficiencies.
// The legend always shows names and values too, so colour is never the only cue.
export const CATEGORY_COLORS = ["#2563eb", "#f59e0b", "#059669", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#64748b"];

export const INCOME_COLOR = "#059669";
export const EXPENSE_COLOR = "#dc2626";

export const compactMYR = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  notation: "compact",
  maximumFractionDigits: 1,
});
