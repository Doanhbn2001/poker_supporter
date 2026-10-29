import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";

type Entry = {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
  /** The hovered data point. */
  payload?: { date?: string; label?: string };
};

/** Shared tooltip: session date (and label like "Cup 2") on top, then one row per series with a color swatch. */
export function ChartTooltip({
  active,
  payload,
  names,
}: {
  active?: boolean;
  payload?: Entry[];
  names?: Record<string, string>;
}) {
  if (!active || !payload?.length) return null;
  // Read the date from the point itself, not the axis label: the axis is keyed by position.
  const point = payload[0].payload;
  const rows = [...payload].sort((a, b) => Number(b.value) - Number(a.value));
  return (
    <div className="rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-md dark:border-neutral-700 dark:bg-neutral-900">
      <div className="mb-1 text-neutral-500">
        {point?.date && formatDate(new Date(`${point.date}T00:00:00Z`))}
        {point?.label && ` · ${point.label}`}
      </div>
      {rows.map((p) => (
        <div key={String(p.dataKey)} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span>{names?.[String(p.dataKey)] ?? p.name}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums">
            {formatMoney(Number(p.value), { signed: true })}
          </span>
        </div>
      ))}
    </div>
  );
}

export const axisProps = {
  stroke: "var(--chart-axis)",
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

export const shortDate = (d: string) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", day: "numeric", month: "short" });

export const moneyTick = (cents: number) => formatMoney(cents, { signed: true });
