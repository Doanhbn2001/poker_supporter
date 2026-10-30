"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Money, TableCard } from "@/components/ui";
import type { PlayerStats } from "@/lib/stats";

type SortKey = "name" | "crowns" | "net" | "wallet" | "cups" | "cashGames" | "sessions" | "winRate" | "avg" | "best" | "worst";
type Row = PlayerStats & { rank: number; winRate: number | null; avg: number | null };
export type LeaderboardVariant = "all" | "tour" | "cash";

/** Sort value per column; null (no sessions yet) always sorts last. */
const VALUE: Record<Exclude<SortKey, "name">, (r: Row) => number | null> = {
  crowns: (r) => r.crowns,
  net: (r) => r.net,
  wallet: (r) => r.wallet,
  cups: (r) => r.cups,
  cashGames: (r) => r.cashGames,
  sessions: (r) => r.sessions,
  winRate: (r) => r.winRate,
  avg: (r) => r.avg,
  best: (r) => r.best,
  worst: (r) => r.worst,
};

type Column = { key: SortKey; label: string; cell: (r: Row) => React.ReactNode };

const dash = (v: number | null, render: (n: number) => React.ReactNode) => (v === null ? "—" : render(v));
const money = (n: number) => <Money cents={n} />;

const COL: Record<SortKey, Column> = {
  name: { key: "name", label: "Player", cell: () => null },
  crowns: { key: "crowns", label: "👑 Crowns", cell: (r) => r.crowns },
  net: { key: "net", label: "Profit", cell: (r) => money(r.net) },
  wallet: { key: "wallet", label: "Wallet", cell: (r) => money(r.wallet) },
  cups: { key: "cups", label: "Tours", cell: (r) => r.cups },
  cashGames: { key: "cashGames", label: "Cash games", cell: (r) => r.cashGames },
  sessions: { key: "sessions", label: "Games", cell: (r) => r.sessions },
  winRate: { key: "winRate", label: "Win rate", cell: (r) => dash(r.winRate, (n) => `${Math.round(n * 100)}%`) },
  avg: { key: "avg", label: "Avg / game", cell: (r) => dash(r.avg, money) },
  best: { key: "best", label: "Best", cell: (r) => dash(r.best, money) },
  worst: { key: "worst", label: "Worst", cell: (r) => dash(r.worst, money) },
};

/** Overall shows totals and the wallet; tournaments (with crowns) and cash show per-game stats of their own games. */
const COLUMNS: Record<LeaderboardVariant, Column[]> = {
  all: [COL.name, COL.net, COL.wallet, COL.cups, COL.cashGames, COL.winRate, COL.avg],
  tour: [COL.name, COL.crowns, COL.net, { ...COL.sessions, label: "Tours" }, COL.winRate, { ...COL.avg, label: "Avg / tour" }, COL.best, COL.worst],
  cash: [COL.name, COL.net, COL.sessions, COL.winRate, COL.avg, COL.best, COL.worst],
};

/** Up/down chevrons; the arrow for the current direction is solid, the other faded. */
function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  return (
    <svg viewBox="0 0 12 12" aria-hidden className="h-3 w-3 shrink-0" fill="currentColor">
      <path d="M6 1.5 9.5 5h-7z" opacity={dir === "asc" ? 1 : 0.35} />
      <path d="M6 10.5 2.5 7h7z" opacity={dir === "desc" ? 1 : 0.35} />
    </svg>
  );
}

export function LeaderboardTable({ players, variant }: { players: PlayerStats[]; variant: LeaderboardVariant }) {
  const columns = COLUMNS[variant];
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
    <TableCard>
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="px-4 py-2">#</th>
            {columns.map((c) => {
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
              {columns.slice(1).map((c) => (
                <td key={c.key} className="px-4 py-2 text-right tabular-nums">{c.cell(p)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}
