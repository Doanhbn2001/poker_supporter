import Link from "next/link";
import { ProgressChart } from "@/components/charts/progress-chart";
import { LeaderboardTabs } from "@/components/leaderboard-tabs";
import { SessionCard } from "@/components/session-card";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { getLeaderboards, getProgress, getSessions } from "@/lib/stats";

export default async function DashboardPage() {
  const me = await requireUser();
  const [boards, recent, tour, cash] = await Promise.all([
    getLeaderboards(),
    getSessions({ take: 5 }),
    getProgress("CUP"),
    getProgress("CASH"),
  ]);

  if (recent.length === 0) {
    return (
      <Card className="text-center">
        <p className={me.role === "ADMIN" ? "mb-4" : ""}>No games logged yet.</p>
        {me.role === "ADMIN" && (
          <div className="flex justify-center gap-6">
            <Link href="/cups/new" className="font-medium text-emerald-600 hover:underline">
              Log the first cup →
            </Link>
            <Link href="/cash/new" className="font-medium text-emerald-600 hover:underline">
              Log the first cash game →
            </Link>
          </div>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Leaderboard</h2>
        <LeaderboardTabs boards={boards} />
      </section>

      {[
        { title: "Tour profit over time", data: tour, empty: "No cups yet." },
        { title: "Cash profit over time", data: cash, empty: "No cash games yet." },
      ].map(({ title, data, empty }) => (
        <section key={title}>
          <h2 className="mb-3 text-lg font-semibold">{title}</h2>
          <Card>
            {data.points.length === 0 ? (
              <p className="text-center text-sm text-neutral-500">{empty}</p>
            ) : (
              <ProgressChart points={data.points} players={data.players} order={boards.all.map((p) => p.userId)} />
            )}
          </Card>
        </section>
      ))}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recent games</h2>
          <span className="flex gap-4 text-sm">
            <Link href="/cups" className="text-emerald-600 hover:underline">All cups →</Link>
            <Link href="/cash" className="text-emerald-600 hover:underline">All cash games →</Link>
          </span>
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
