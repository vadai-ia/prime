"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from "./theme";

export type ChannelPoint = { label: string; applications: number; prefilter_passed: number; hired: number };

const NAMES: Record<string, string> = { applications: "Postulantes", prefilter_passed: "Pasaron prefiltro", hired: "Contratados" };

export function ChannelChart({ data }: { data: ChannelPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }} barCategoryGap={16}>
          <CartesianGrid vertical={false} stroke={CHART.line} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} />
          <Tooltip {...TOOLTIP_STYLE} formatter={(value: unknown, name: unknown) => [`${value}`, NAMES[String(name)] ?? String(name)]} />
          <Legend formatter={(value: string) => <span style={{ color: CHART.muted, fontSize: 12 }}>{NAMES[value] ?? value}</span>} />
          <Bar dataKey="applications" fill={CHART.info} radius={[4, 4, 0, 0]} />
          <Bar dataKey="prefilter_passed" fill={CHART.leaf} radius={[4, 4, 0, 0]} />
          <Bar dataKey="hired" fill={CHART.forest} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
