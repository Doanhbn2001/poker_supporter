"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { axisProps, ChartTooltip, moneyTick, shortDate } from "./chart-tooltip";

type Point = { date: string; net: number; total: number };

export function CumulativeChart({ data }: { data: Point[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
          <YAxis tickFormatter={moneyTick} width={56} {...axisProps} />
          <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.5} />
          <Tooltip content={<ChartTooltip names={{ total: "Total" }} />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} />
          <Line
            dataKey="total"
            type="linear"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={data.length <= 30 ? { r: 3, strokeWidth: 0, fill: "var(--series-1)" } : false}
            activeDot={{ r: 5, stroke: "var(--chart-surface)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SessionResultsChart({ data }: { data: Point[] }) {
  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 8 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
          <YAxis tickFormatter={moneyTick} width={56} {...axisProps} />
          <ReferenceLine y={0} stroke="var(--chart-axis)" />
          <Tooltip content={<ChartTooltip names={{ net: "Result" }} />} cursor={{ fill: "var(--chart-grid)", fillOpacity: 0.5 }} />
          <Bar dataKey="net" maxBarSize={28} radius={[4, 4, 4, 4]} isAnimationActive={false}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.net >= 0 ? "var(--chart-win)" : "var(--chart-loss)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
