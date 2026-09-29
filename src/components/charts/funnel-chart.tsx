"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from "./theme";

export type FunnelPoint = { label: string; value: number };

export function FunnelChart({ data }: { data: FunnelPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={CHART.line} />
          <XAxis type="number" allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="label" width={130} tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(value: unknown) => [`${value}`, "Postulaciones"]} />
          <Bar dataKey="value" fill={CHART.forest} radius={[0, 6, 6, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
