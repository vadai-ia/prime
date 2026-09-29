"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from "./theme";

export type DurationPoint = { label: string; hours: number; samples: number };

function fmtHours(h: number): string {
  if (h < 24) return `${Math.round(h)} h`;
  const d = h / 24;
  return `${d.toFixed(d < 10 ? 1 : 0)} días`;
}

export function StageDurationChart({ data }: { data: DurationPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={16}>
          <CartesianGrid vertical={false} stroke={CHART.line} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval={0} />
          <YAxis tick={AXIS_TICK} axisLine={false} tickLine={false} width={44} tickFormatter={(v: number) => fmtHours(v)} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(value: unknown) => [fmtHours(Number(value)), "Mediana en etapa"]} />
          <Bar dataKey="hours" fill={CHART.amber} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
