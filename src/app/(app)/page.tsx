import Link from "next/link";
import { ProgressChart } from "@/components/charts/progress-chart";
import { CollapsibleSection } from "@/components/collapsible-section";
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
            <Link href="/tournaments/new" className="font-medium text-emerald-600 hover:underline">
              Log the first tournament →
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
      <CollapsibleSection title="Leaderboard">
        <LeaderboardTabs boards={boards} />
      </CollapsibleSection>

      {[
        { title: "Tournament profit over time", data: tour, empty: "No tournaments yet." },
        { title: "Cash profit over time", data: cash, empty: "No cash games yet." },
      ].map(({ title, data, empty }) => (
        <CollapsibleSection key={title} title={title}>
          <Card>
            {data.points.length === 0 ? (
              <p className="text-center text-sm text-neutral-500">{empty}</p>
            ) : (
              <ProgressChart points={data.points} players={data.players} order={boards.all.map((p) => p.userId)} />
            )}
          </Card>
        </CollapsibleSection>
      ))}

      <CollapsibleSection
        title="Recent games"
        className="space-y-2"
        actions={
          <span className="flex gap-4">
            <Link href="/tournaments" className="text-emerald-600 hover:underline">All tournaments →</Link>
            <Link href="/cash" className="text-emerald-600 hover:underline">All cash games →</Link>
          </span>
        }
      >
        {recent.map((s) => (
          <SessionCard key={s.id} session={s} />
        ))}
      </CollapsibleSection>
    </div>
  );
}
