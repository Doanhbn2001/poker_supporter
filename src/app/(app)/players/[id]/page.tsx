import Link from "next/link";
import { notFound } from "next/navigation";
import { CumulativeChart, SessionResultsChart } from "@/components/charts/player-charts";
import { Card, Money } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getPlayerHistory, statsFromHistory } from "@/lib/stats";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{children}</div>
    </Card>
  );
}

export default async function PlayerPage({ params }: PageProps<"/players/[id]">) {
  const { id } = await params;
  await requireUser();
  const player = await prisma.user.findUnique({
    where: { id },
    select: { displayName: true, username: true },
  });
  if (!player) notFound();

  const history = await getPlayerHistory(id);
  const stats = statsFromHistory(history);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/players" className="text-sm text-neutral-500 hover:underline">
          ← All players
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{player.displayName}</h1>
        <p className="text-sm text-neutral-500">@{player.username}</p>
      </div>

      {!stats ? (
        <Card className="text-center text-neutral-500">No sessions yet.</Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Net profit"><Money cents={stats.net} /></Stat>
            <Stat label="Sessions">{stats.sessions}</Stat>
            <Stat label="Win rate">{Math.round((stats.wins / stats.sessions) * 100)}%</Stat>
            <Stat label="Avg / session"><Money cents={Math.round(stats.net / stats.sessions)} /></Stat>
            <Stat label="Best night"><Money cents={stats.best} /></Stat>
            <Stat label="Worst night"><Money cents={stats.worst} /></Stat>
            <Stat label="Last 5 sessions"><Money cents={stats.lastFive} /></Stat>
            <Stat label="Current streak">
              {stats.streak === 0 ? "None" : `${Math.abs(stats.streak)} ${stats.streak > 0 ? "win" : "loss"}${Math.abs(stats.streak) > 1 ? (stats.streak > 0 ? "s" : "es") : ""}`}
            </Stat>
          </div>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Profit over time</h2>
            <Card>
              <CumulativeChart data={history} />
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Result per session</h2>
            <Card>
              <SessionResultsChart data={history} />
            </Card>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">History</h2>
            <Card className="overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead className="text-left text-neutral-500">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2 text-right">Buy-in</th>
                    <th className="px-4 py-2 text-right">Cash-out</th>
                    <th className="px-4 py-2 text-right">Net</th>
                    <th className="px-4 py-2 text-right">Running total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...history].reverse().map((h) => (
                    <tr key={h.sessionId} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                      <td className="px-4 py-2">
                        <Link href={`/sessions/${h.sessionId}`} className="hover:underline">
                          {formatDate(new Date(`${h.date}T00:00:00Z`))}
                        </Link>
                        {h.location && <span className="text-neutral-500"> · {h.location}</span>}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMoney(h.buyIn)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatMoney(h.cashOut)}</td>
                      <td className="px-4 py-2 text-right"><Money cents={h.net} /></td>
                      <td className="px-4 py-2 text-right"><Money cents={h.total} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>
        </>
      )}
    </div>
  );
}
