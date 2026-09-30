"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisProps, ChartTooltip, moneyTick, shortDate } from "./chart-tooltip";

const SLOTS = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)", "var(--series-5)"];
const MAX_SELECTED = SLOTS.length;

type Player = { id: string; name: string; net: number };

/**
 * Running profit per player. Up to five players at a time; each keeps its color
 * while selected, so toggling someone else never repaints the others.
 */
export function ProgressChart({ points, players }: { points: Record<string, number | string>[]; players: Player[] }) {
  // Map of playerId -> color slot index.
  const [slots, setSlots] = useState<Record<string, number>>(() =>
    Object.fromEntries(players.slice(0, 3).map((p, i) => [p.id, i])),
  );

  const toggle = (id: string) =>
    setSlots((current) => {
      if (id in current) {
        const next = { ...current };
        delete next[id];
        return next;
      }
      const used = new Set(Object.values(current));
      const free = SLOTS.findIndex((_, i) => !used.has(i));
      return free === -1 ? current : { ...current, [id]: free };
    });

  const selected = players.filter((p) => p.id in slots);
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const full = selected.length >= MAX_SELECTED;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {players.map((p) => {
          const on = p.id in slots;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              disabled={!on && full}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs disabled:opacity-40 ${
                on ? "border-neutral-400 dark:border-neutral-500" : "border-neutral-200 text-neutral-500 dark:border-neutral-800"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: on ? SLOTS[slots[p.id]] : "transparent", outline: on ? "none" : "1px solid currentColor" }}
              />
              {p.name}
            </button>
          );
        })}
      </div>
      {full && <p className="mb-2 text-xs text-neutral-500">Showing {MAX_SELECTED} players at most. Unselect one to add another.</p>}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="date" tickFormatter={shortDate} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={moneyTick} width={56} {...axisProps} />
            <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.5} />
            <Tooltip content={<ChartTooltip names={names} />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} />
            {selected.map((p) => (
              <Line
                key={p.id}
                dataKey={p.id}
                name={p.name}
                type="linear"
                stroke={SLOTS[slots[p.id]]}
                strokeWidth={2}
                dot={points.length <= 20 ? { r: 3, strokeWidth: 0, fill: SLOTS[slots[p.id]] } : false}
                activeDot={{ r: 5, stroke: "var(--chart-surface)", strokeWidth: 2 }}
                connectNulls
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
