import { createGameSession } from "@/app/actions/sessions";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { GAME, type GameKind } from "@/lib/games";
import { getGamesByDate } from "@/lib/stats";
import { GameForm } from "./game-form";

export async function GameNewPage({ type }: { type: GameKind }) {
  await requireAdmin();
  // Admin accounts manage the app and don't play, so they aren't offered as players.
  const [players, gamesByDate] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PLAYER" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    getGamesByDate(type),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold">Log a {GAME[type].noun}</h1>
      <GameForm type={type} players={players} action={createGameSession.bind(null, type)} gamesByDate={gamesByDate} />
    </div>
  );
}
