"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CategorySlice } from "@/lib/dashboard/aggregate";
import { formatMYR } from "@/lib/utils";
import { CATEGORY_COLORS, chartMotion, TOOLTIP_STYLE } from "./palette";

/** Donut of spending by category. The legend list carries the data for screen readers. */
export function CategoryDonut({ slices, totalCents }: { slices: CategorySlice[]; totalCents: number }) {
  if (slices.length === 0) {
    return (
      <p className="flex h-48 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        No spending this month.
      </p>
    );
  }
  const data = slices.map((s) => ({ ...s, value: s.cents / 100 }));

  return (
    <div className="grid items-center gap-4 sm:grid-cols-[minmax(0,12rem)_1fr]">
      <div className="relative h-48" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart accessibilityLayer={false}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="category"
              innerRadius="62%"
              outerRadius="95%"
              paddingAngle={slices.length > 1 ? 1.5 : 0}
              stroke="hsl(var(--card))"
              {...chartMotion(100)}
            >
              {data.map((s, i) => (
                <Cell key={s.category} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [formatMYR(Number(value)), String(name)]}
              contentStyle={TOOLTIP_STYLE}
              itemStyle={{ color: "hsl(var(--foreground))" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">Spent</span>
          <span className="text-sm font-semibold tabular-nums">{formatMYR(totalCents / 100)}</span>
        </div>
      </div>

      <ul className="space-y-1.5 text-sm" aria-label="Spending by category">
        {slices.map((s, i) => (
          <li key={s.category} className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
              aria-hidden="true"
            />
            <span className="min-w-0 flex-1 truncate">{s.category}</span>
            <span className="tabular-nums">{formatMYR(s.cents / 100)}</span>
            <span className="w-12 text-right tabular-nums text-muted-foreground">{s.percent}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
