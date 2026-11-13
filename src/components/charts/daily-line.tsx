"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DayPoint } from "@/lib/dashboard/aggregate";
import { formatMYR } from "@/lib/utils";
import { chartMotion, compactMYR, TOOLTIP_STYLE } from "./palette";

const dayFmt = new Intl.DateTimeFormat("en-MY", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

const LINE = "#2dd4bf";
const GLOW = "#a78bfa";
const PEAK = "#fbbf24";

interface PeakShapeProps {
  cx?: number;
  cy?: number;
  label: string;
  /** Flip the callout to the left of the dot when the peak sits near the right edge. */
  flip: boolean;
}

/** Glowing amber marker with a small callout, like a "predicted" pin on a forecast chart. */
function PeakShape({ cx = 0, cy = 0, label, flip }: PeakShapeProps) {
  const w = 96;
  const h = 36;
  const x = flip ? cx - w - 14 : cx + 14;
  const y = Math.max(cy - h - 10, 0);
  return (
    <g className="animate-fade-in [animation-delay:1100ms]">
      <line x1={cx} y1={cy} x2={flip ? x + w : x} y2={y + h} stroke={PEAK} strokeWidth={1} opacity={0.7} />
      <circle cx={cx} cy={cy} r={10} fill={PEAK} opacity={0.2} />
      <circle cx={cx} cy={cy} r={5} fill={PEAK} />
      <rect x={x} y={y} width={w} height={h} rx={6} fill="hsl(var(--card))" stroke={PEAK} strokeOpacity={0.8} />
      <text x={x + 8} y={y + 14} fontSize={10} fill="hsl(var(--muted-foreground))">
        Highest day
      </text>
      <text x={x + 8} y={y + 28} fontSize={12} fontWeight={600} fill="hsl(var(--foreground))">
        {label}
      </text>
    </g>
  );
}

/** Daily spending for one month. Screen readers get `summary` instead of the SVG. */
export function DailyLine({ points, summary }: { points: DayPoint[]; summary: string }) {
  const gradId = useId().replace(/:/g, "");
  const data = points.map((p) => ({ day: p.day, label: p.label, total: p.cents / 100 }));
  const labelByDay = new Map(data.map((d) => [d.day, d.label]));

  let peakIndex = -1;
  data.forEach((d, i) => {
    if (d.total > 0 && (peakIndex === -1 || d.total > data[peakIndex].total)) peakIndex = i;
  });
  const peak = peakIndex >= 0 ? data[peakIndex] : null;

  return (
    <div
      role="img"
      aria-label={summary}
      className="h-64 w-full [&_.recharts-area-curve]:[filter:drop-shadow(0_0_6px_rgba(45,212,191,0.6))]"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 16, right: 16, bottom: 0, left: 0 }} accessibilityLayer={false}>
          <defs>
            <linearGradient id={`${gradId}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={GLOW} stopOpacity={0.3} />
              <stop offset="100%" stopColor={LINE} stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="2 6" vertical={false} stroke="hsl(var(--border))" />
          <XAxis
            dataKey="day"
            tickFormatter={(d: string) => labelByDay.get(d) ?? d}
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
            labelFormatter={(day) => (typeof day === "string" && day ? dayFmt.format(new Date(`${day}T00:00:00Z`)) : "")}
            contentStyle={TOOLTIP_STYLE}
            cursor={{ stroke: LINE, strokeOpacity: 0.3 }}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke={LINE}
            strokeWidth={2.5}
            fill={`url(#${gradId}-fill)`}
            dot={false}
            activeDot={{ r: 5, fill: PEAK, stroke: "hsl(var(--card))", strokeWidth: 2 }}
            {...chartMotion()}
          />
          {peak && (
            <ReferenceDot
              x={peak.day}
              y={peak.total}
              ifOverflow="visible"
              shape={(p: { cx?: number; cy?: number }) => (
                <PeakShape cx={p.cx} cy={p.cy} label={formatMYR(peak.total)} flip={peakIndex > data.length * 0.6} />
              )}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
