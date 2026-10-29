import Link from "next/link";
import { ProgressChart } from "@/components/charts/progress-chart";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { SessionCard } from "@/components/session-card";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { getLeaderboard, getProgress, getSessions } from "@/lib/stats";

export default async function DashboardPage() {
  const me = await requireUser();
  const [leaderboard, recent, progress] = await Promise.all([getLeaderboard(), getSessions(5), getProgress()]);

  if (recent.length === 0) {
    return (
      <Card className="text-center">
        <p className={me.role === "ADMIN" ? "mb-4" : ""}>No sessions logged yet.</p>
        {me.role === "ADMIN" && (
          <Link href="/sessions/new" className="font-medium text-emerald-600 hover:underline">
            Log the first session →
          </Link>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-lg font-semibold">Leaderboard</h2>
        <LeaderboardTable players={leaderboard} />
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
