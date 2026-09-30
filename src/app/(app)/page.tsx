import Link from "next/link";
import { Card, Money } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { formatMoney } from "@/lib/money";
import { getLeaderboard, getRecentSessions } from "@/lib/stats";

export default async function DashboardPage() {
  await requireUser();
  const [leaderboard, recent] = await Promise.all([getLeaderboard(), getRecentSessions()]);

  if (recent.length === 0) {
    return (
      <Card className="text-center">
        <p className="mb-4">No sessions logged yet.</p>
        <Link href="/sessions/new" className="font-medium text-emerald-600 hover:underline">
          Log the first session →
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Leaderboard</h2>
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr className="border-b border-neutral-200 dark:border-neutral-800">
                <th className="px-4 py-2">#</th>
                <th className="px-4 py-2">Player</th>
                <th className="px-4 py-2 text-right">Net</th>
                <th className="px-4 py-2 text-right">Sessions</th>
                <th className="px-4 py-2 text-right">Win rate</th>
                <th className="px-4 py-2 text-right">Avg / session</th>
                <th className="px-4 py-2 text-right">Best</th>
                <th className="px-4 py-2 text-right">Worst</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((p, i) => (
                <tr key={p.userId} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                  <td className="px-4 py-2 text-neutral-500">{i + 1}</td>
                  <td className="px-4 py-2 font-medium">{p.displayName}</td>
                  <td className="px-4 py-2 text-right"><Money cents={p.net} /></td>
                  <td className="px-4 py-2 text-right">{p.sessions}</td>
                  <td className="px-4 py-2 text-right">{Math.round((p.wins / p.sessions) * 100)}%</td>
                  <td className="px-4 py-2 text-right"><Money cents={Math.round(p.net / p.sessions)} /></td>
                  <td className="px-4 py-2 text-right"><Money cents={p.best} /></td>
                  <td className="px-4 py-2 text-right"><Money cents={p.worst} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Recent sessions</h2>
        <div className="space-y-2">
          {recent.map((s) => (
            <Card key={s.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <div>
                <div className="font-medium">
                  {s.playedAt.toLocaleDateString("en-GB", { timeZone: "UTC", dateStyle: "medium" })}
                  {s.location && <span className="text-neutral-500"> · {s.location}</span>}
                </div>
                <div className="text-sm text-neutral-500">
                  {s.players} players · {formatMoney(s.pot)} total buy-ins
                </div>
              </div>
              {s.winner && (
                <div className="text-sm">
                  Top: <span className="font-medium">{s.winner.name}</span> <Money cents={s.winner.net} />
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
