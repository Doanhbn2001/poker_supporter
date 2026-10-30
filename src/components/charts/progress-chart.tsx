"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { axisProps, ChartTooltip, moneyTick, shortDate } from "./chart-tooltip";

const SLOTS = Array.from({ length: 10 }, (_, i) => `var(--series-${i + 1})`);
const MAX_SELECTED = SLOTS.length;

type Player = { id: string; name: string; net: number };

/**
 * Running profit per player, up to ten at a time. `order` (player ids, overall leaderboard order) fixes
 * both the chip order and each player's color, so a player looks the same in every chart on the page.
 */
export function ProgressChart({
  points,
  players: unordered,
  order,
}: {
  points: Record<string, number | string>[];
  players: Player[];
  order: string[];
}) {
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i === -1 ? order.length : i;
  };
  const players = [...unordered].sort((a, b) => rank(a.id) - rank(b.id));
  const color = (id: string) => SLOTS[rank(id) % SLOTS.length];

  // Starts with the top three overall who played this kind of game.
  const [on, setOn] = useState<Set<string>>(() => new Set(players.slice(0, 3).map((p) => p.id)));
  const toggle = (id: string) =>
    setOn((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else if (next.size < MAX_SELECTED) next.add(id);
      return next;
    });

  const selected = players.filter((p) => on.has(p.id));
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const full = selected.length >= MAX_SELECTED;

  return (
    <div>
      <div className="mb-4 flex flex-wrap gap-2">
        {players.map((p) => {
          const isOn = on.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => toggle(p.id)}
              disabled={!isOn && full}
              aria-pressed={isOn}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs disabled:opacity-40 ${
                isOn ? "border-neutral-400 dark:border-neutral-500" : "border-neutral-200 text-neutral-500 dark:border-neutral-800"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: isOn ? color(p.id) : "transparent", outline: isOn ? "none" : "1px solid currentColor" }}
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
            <XAxis dataKey="x" tickFormatter={(x: number) => (points[x]?.date ? shortDate(String(points[x].date)) : "Start")} minTickGap={24} {...axisProps} />
            <YAxis tickFormatter={moneyTick} width={56} {...axisProps} />
            <ReferenceLine y={0} stroke="var(--chart-axis)" strokeOpacity={0.5} />
            <Tooltip content={<ChartTooltip names={names} />} cursor={{ stroke: "var(--chart-axis)", strokeDasharray: "3 3" }} />
            {selected.map((p) => (
              <Line
                key={p.id}
                dataKey={p.id}
                name={p.name}
                type="linear"
                stroke={color(p.id)}
                strokeWidth={2}
                dot={points.length <= 20 ? { r: 3, strokeWidth: 0, fill: color(p.id) } : false}
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
