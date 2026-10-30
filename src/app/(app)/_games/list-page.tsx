import Link from "next/link";
import { SessionCard } from "@/components/session-card";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { GAME, type GameKind } from "@/lib/games";
import { getSessions } from "@/lib/stats";

export async function GameListPage({ type }: { type: GameKind }) {
  const me = await requireUser();
  const game = GAME[type];
  const sessions = await getSessions({ type });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">{game.plural}</h1>
        {me.role === "ADMIN" && (
          <Link href={`${game.base}/new`} className="text-sm font-medium text-emerald-600 hover:underline">
            + Log {game.noun}
          </Link>
        )}
      </div>
      {sessions.length === 0 ? (
        <Card className="text-center text-neutral-500">No {game.plural.toLowerCase()} logged yet.</Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
