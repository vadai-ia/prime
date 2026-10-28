"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_TICK, CHART, TOOLTIP_STYLE } from "./theme";

export type TrendPoint = { label: string; applications: number; interviews: number; hired: number };
export type TrendUnit = "day" | "week" | "month";

const NAMES: Record<string, string> = { applications: "Postulaciones", interviews: "Entrevistas realizadas", hired: "Contratados" };

const TOOLTIP_LABEL: Record<TrendUnit, (label: string) => string> = {
  day: (label) => label,
  week: (label) => `Semana del ${label}`,
  month: (label) => label,
};

export function TrendChart({ data, unit = "week" }: { data: TrendPoint[]; unit?: TrendUnit }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid vertical={false} stroke={CHART.line} />
          <XAxis dataKey="label" tick={AXIS_TICK} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={16} />
          <YAxis allowDecimals={false} tick={AXIS_TICK} axisLine={false} tickLine={false} width={32} />
          <Tooltip {...TOOLTIP_STYLE} cursor={{ stroke: CHART.line }} labelFormatter={(label: unknown) => TOOLTIP_LABEL[unit](String(label))} formatter={(value: unknown, name: unknown) => [`${value}`, NAMES[String(name)] ?? String(name)]} />
          <Legend formatter={(value: string) => <span style={{ color: CHART.muted, fontSize: 12 }}>{NAMES[value] ?? value}</span>} />
          <Line type="monotone" dataKey="applications" stroke={CHART.info} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="interviews" stroke={CHART.leaf} strokeWidth={2.5} dot={false} />
          <Line type="monotone" dataKey="hired" stroke={CHART.forest} strokeWidth={2.5} dot={data.length <= 31 ? { r: 3 } : false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
