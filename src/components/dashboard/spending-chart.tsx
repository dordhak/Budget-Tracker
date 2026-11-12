"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SpendingPoint } from "@/lib/spending";
import { formatMYR } from "@/lib/utils";

const compactMYR = new Intl.NumberFormat("en-MY", {
  style: "currency",
  currency: "MYR",
  notation: "compact",
  maximumFractionDigits: 1,
});

/**
 * Client Component: Recharts needs the browser for layout and hover.
 * Receives plain serialisable data from the server-rendered dashboard.
 */
export function SpendingChart({ points, summary }: { points: SpendingPoint[]; summary: string }) {
  return (
    // Screen readers get the text summary instead of the SVG internals.
    <div role="img" aria-label={summary} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={points}
            margin={{ top: 8, right: 12, bottom: 0, left: 0 }}
            // The wrapper is role="img" with a text summary; skip the nested keyboard layer.
            accessibilityLayer={false}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            />
            <YAxis
              width={64}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              tickFormatter={(v: number) => compactMYR.format(v)}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            />
            <Tooltip
              formatter={(value) => [formatMYR(Number(value)), "Spent"]}
              labelClassName="font-medium"
              contentStyle={{
                borderRadius: 8,
                border: "1px solid hsl(var(--border))",
                background: "hsl(var(--background))",
                fontSize: 12,
              }}
            />
            <Line
              type="monotone"
              dataKey="total"
              name="Spent"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
    </div>
  );
}
