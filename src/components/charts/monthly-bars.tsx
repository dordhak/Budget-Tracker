"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MonthPoint } from "@/lib/dashboard/aggregate";
import { monthLabel } from "@/lib/month";
import { formatMYR } from "@/lib/utils";
import { compactMYR, EXPENSE_COLOR, INCOME_COLOR } from "./palette";

/** Income vs expenses per month. A visually hidden table carries the same data. */
export function MonthlyBars({ points }: { points: MonthPoint[] }) {
  const data = points.map((p) => ({ label: p.label, month: p.month, Income: p.incomeCents / 100, Expenses: p.expenseCents / 100 }));

  return (
    <div>
      <div className="h-64 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer={false}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => compactMYR.format(v)}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              formatter={(value, name) => [formatMYR(Number(value)), String(name)]}
              labelFormatter={(_, payload) => (payload?.[0]?.payload?.month ? monthLabel(payload[0].payload.month) : "")}
              contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Income" fill={INCOME_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
            <Bar dataKey="Expenses" fill={EXPENSE_COLOR} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Income and expenses per month</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Income</th>
            <th scope="col">Expenses</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <th scope="row">{monthLabel(p.month)}</th>
              <td>{formatMYR(p.incomeCents / 100)}</td>
              <td>{formatMYR(p.expenseCents / 100)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
