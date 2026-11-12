"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayPoint } from "@/lib/dashboard/aggregate";
import { formatMYR } from "@/lib/utils";
import { compactMYR } from "./palette";

const dayFmt = new Intl.DateTimeFormat("en-MY", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** Daily spending for one month. Screen readers get `summary` instead of the SVG. */
export function DailyLine({ points, summary }: { points: DayPoint[]; summary: string }) {
  const data = points.map((p) => ({ day: p.day, label: p.label, total: p.cents / 100 }));
  return (
    <div role="img" aria-label={summary} className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={16}
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
            labelFormatter={(_, payload) => (payload?.[0]?.payload?.day ? dayFmt.format(new Date(`${payload[0].payload.day}T00:00:00Z`)) : "")}
            contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }}
          />
          <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
