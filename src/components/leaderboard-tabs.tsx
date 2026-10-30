"use client";

import { useState } from "react";
import { LeaderboardTable, type LeaderboardVariant } from "@/components/leaderboard-table";
import type { Leaderboards } from "@/lib/stats";

const TABS: { key: LeaderboardVariant; label: string; hint: string }[] = [
  { key: "all", label: "Overall", hint: "Cups + cash games. Wallet = profit + deposits − withdrawals." },
  { key: "tour", label: "Tour", hint: "Cups only." },
  { key: "cash", label: "Cash", hint: "Cash games only." },
];

export function LeaderboardTabs({ boards }: { boards: Leaderboards }) {
  const [tab, setTab] = useState<LeaderboardVariant>("all");
  const current = TABS.find((t) => t.key === tab)!;

  return (
    <div>
      <div role="tablist" className="mb-3 flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full border px-3 py-1 text-sm ${
              tab === t.key
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-neutral-300 text-neutral-600 hover:border-emerald-600 dark:border-neutral-700 dark:text-neutral-300"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="text-xs text-neutral-500">{current.hint}</span>
      </div>
      {/* Keyed so each tab starts from its own default sort. */}
      <LeaderboardTable key={tab} players={boards[tab]} variant={tab} />
    </div>
  );
}
