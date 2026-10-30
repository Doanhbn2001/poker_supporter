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
        // Fills the screen below the title (10.5rem = top bar + title row + page padding) and scrolls inside,
        // but never shrinks below 20rem on very short screens (the page scrolls a little instead).
        <div className="max-h-[max(20rem,calc(100dvh_-_10.5rem))] space-y-2 overflow-y-auto pr-1">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
