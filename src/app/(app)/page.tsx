import Link from "next/link";
import { ProgressChart } from "@/components/charts/progress-chart";
import { SessionCard } from "@/components/session-card";
import { Card, Money } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { getLeaderboard, getProgress, getSessions } from "@/lib/stats";

export default async function DashboardPage() {
  await requireUser();
  const [leaderboard, recent, progress] = await Promise.all([getLeaderboard(), getSessions(5), getProgress()]);

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
                  <td className="px-4 py-2 font-medium">
                    <Link href={`/players/${p.userId}`} className="hover:underline">
                      {p.displayName}
                    </Link>
                  </td>
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
        <h2 className="mb-3 text-lg font-semibold">Profit over time</h2>
        <Card>
          <ProgressChart points={progress.points} players={progress.players} />
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent sessions</h2>
          <Link href="/sessions" className="text-sm text-emerald-600 hover:underline">
            All sessions →
          </Link>
        </div>
        <div className="space-y-2">
          {recent.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      </section>
    </div>
  );
}
