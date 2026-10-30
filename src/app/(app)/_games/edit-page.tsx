import { notFound, redirect } from "next/navigation";
import { updateGameSession } from "@/app/actions/sessions";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { GAME, type GameKind } from "@/lib/games";
import { getGamesByDate } from "@/lib/stats";
import { GameForm } from "./game-form";

const toInput = (cents: number) => String(cents / 100);

export async function GameEditPage({ id, type }: { id: string; type: GameKind }) {
  await requireAdmin();
  const [session, players, sameDays] = await Promise.all([
    prisma.gameSession.findUnique({ where: { id }, include: { results: true } }),
    // Players, plus anyone already in this session so existing rows keep their selection.
    prisma.user.findMany({
      where: { OR: [{ role: "PLAYER" }, { results: { some: { sessionId: id } } }] },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    getGamesByDate(type, id),
  ]);
  if (!session) notFound();
  if (session.type !== type) redirect(`${GAME[session.type].base}/${id}/edit`);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold">Edit {GAME[type].noun}</h1>
      <GameForm
        type={type}
        players={players}
        action={updateGameSession.bind(null, id)}
        submitLabel="Save changes"
        gamesByDate={sameDays}
        initial={{
          playedAt: session.playedAt.toISOString().slice(0, 10),
          notes: session.notes ?? "",
          championId: session.championId ?? "",
          results: session.results.map((r) => ({
            playerId: r.userId,
            buyIn: toInput(r.buyIn),
            cashOut: toInput(r.cashOut),
          })),
        }}
      />
    </div>
  );
}
