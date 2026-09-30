import Link from "next/link";
import { Card, Money } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getLeaderboard } from "@/lib/stats";
import { AddPlayerForm } from "./add-player-form";

export default async function PlayersPage() {
  const me = await requireUser();
  const [players, leaderboard] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, username: true, displayName: true, role: true },
      orderBy: { displayName: "asc" },
    }),
    getLeaderboard(),
  ]);
  const netById = new Map(leaderboard.map((p) => [p.userId, p]));
  const isAdmin = me.role === "ADMIN";

  return (
    <div className={isAdmin ? "grid gap-6 md:grid-cols-2" : ""}>
      <section>
        <h1 className="mb-3 text-xl font-semibold">Players</h1>
        <Card className="divide-y divide-neutral-100 p-0 dark:divide-neutral-800">
          {players.map((p) => {
            const stats = netById.get(p.id);
            return (
              <Link
                key={p.id}
                href={`/players/${p.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
              >
                <span>
                  <span className="font-medium">{p.displayName}</span>
                  <span className="text-neutral-500">
                    {" "}
                    @{p.username}
                    {p.role === "ADMIN" && " · admin"}
                  </span>
                </span>
                <span className="text-right">
                  {stats ? (
                    <>
                      <Money cents={stats.net} />
                      <span className="text-neutral-500"> · {stats.sessions} sessions</span>
                    </>
                  ) : (
                    <span className="text-neutral-500">No sessions yet</span>
                  )}
                </span>
              </Link>
            );
          })}
        </Card>
      </section>
      {isAdmin && (
        <section>
          <h2 className="mb-3 text-xl font-semibold">Add a player</h2>
          <Card>
            <AddPlayerForm />
          </Card>
        </section>
      )}
    </div>
  );
}
