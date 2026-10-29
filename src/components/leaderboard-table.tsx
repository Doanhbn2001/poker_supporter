"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Card, Money } from "@/components/ui";
import type { PlayerStats } from "@/lib/stats";

type SortKey = "name" | "crowns" | "net" | "sessions" | "winRate" | "avg" | "best" | "worst";
type Row = PlayerStats & { rank: number; winRate: number | null; avg: number | null };

/** Sort value per column; null (no sessions yet) always sorts last. */
const VALUE: Record<Exclude<SortKey, "name">, (r: Row) => number | null> = {
  crowns: (r) => r.crowns,
  net: (r) => r.net,
  sessions: (r) => r.sessions,
  winRate: (r) => r.winRate,
  avg: (r) => r.avg,
  best: (r) => r.best,
  worst: (r) => r.worst,
};

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Player" },
  { key: "crowns", label: "👑 Crowns" },
  { key: "net", label: "Net" },
  { key: "sessions", label: "Sessions" },
  { key: "winRate", label: "Win rate" },
  { key: "avg", label: "Avg / session" },
  { key: "best", label: "Best" },
  { key: "worst", label: "Worst" },
];

const dash = (v: number | null, render: (n: number) => React.ReactNode) => (v === null ? "—" : render(v));

/** Up/down chevrons; the arrow for the current direction is solid, the other faded. */
function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 shrink-0" fill="currentColor">
      <path d="M6 1.5 9.5 5h-7z" opacity={dir === "asc" ? 1 : 0.35} />
      <path d="M6 10.5 2.5 7h7z" opacity={dir === "desc" ? 1 : 0.35} />
    </svg>
  );
}

export function LeaderboardTable({ players }: { players: PlayerStats[] }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: "net", desc: true });

  // `players` arrives sorted by net, so the index is the rank.
  const rows = useMemo<Row[]>(
    () =>
      players.map((p, i) => ({
        ...p,
        rank: i + 1,
        winRate: p.sessions > 0 ? p.wins / p.sessions : null,
        avg: p.sessions > 0 ? Math.round(p.sessionNet / p.sessions) : null,
      })),
    [players],
  );

  const sorted = useMemo(() => {
    const dir = sort.desc ? -1 : 1;
    if (sort.key === "name") {
      return [...rows].sort((a, b) => dir * a.displayName.localeCompare(b.displayName, "vi"));
    }
    const value = VALUE[sort.key];
    return [...rows].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      if (va === null || vb === null) return va === vb ? a.rank - b.rank : va === null ? 1 : -1;
      return dir * (va - vb) || a.rank - b.rank;
    });
  }, [rows, sort]);

  const toggle = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== "name" }));

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="px-4 py-2">#</th>
            {COLUMNS.map((c) => {
              const active = sort.key === c.key;
              return (
                <th
                  key={c.key}
                  aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
                  className={`px-4 py-2 ${c.key === "name" ? "" : "text-right"}`}
                >
                  <button
                    type="button"
                    onClick={() => toggle(c.key)}
                    className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-neutral-900 dark:hover:text-neutral-100 ${
                      active ? "font-semibold text-neutral-900 dark:text-neutral-100" : ""
                    }`}
                  >
                    {c.label}
                    <SortIcon dir={active ? (sort.desc ? "desc" : "asc") : null} />
                  </button>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.userId} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
              <td className="px-4 py-2 text-neutral-500">{p.rank}</td>
              <td className="px-4 py-2 font-medium">
                <Link href={`/players/${p.userId}`} className="hover:underline">
                  {p.displayName}
                </Link>
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{p.crowns}</td>
              <td className="px-4 py-2 text-right"><Money cents={p.net} /></td>
              <td className="px-4 py-2 text-right">{p.sessions}</td>
              <td className="px-4 py-2 text-right">{dash(p.winRate, (n) => `${Math.round(n * 100)}%`)}</td>
              <td className="px-4 py-2 text-right">{dash(p.avg, (n) => <Money cents={n} />)}</td>
              <td className="px-4 py-2 text-right">{dash(p.best, (n) => <Money cents={n} />)}</td>
              <td className="px-4 py-2 text-right">{dash(p.worst, (n) => <Money cents={n} />)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
