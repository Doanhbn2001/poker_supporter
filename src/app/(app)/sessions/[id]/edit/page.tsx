import { notFound } from "next/navigation";
import { updateGameSession } from "@/app/actions/sessions";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getCupsByDate } from "@/lib/stats";
import { SessionForm } from "../../session-form";

const toInput = (cents: number) => String(cents / 100);

export default async function EditSessionPage({ params }: PageProps<"/sessions/[id]/edit">) {
  const { id } = await params;
  await requireAdmin();
  const [session, players, sameDays] = await Promise.all([
    prisma.gameSession.findUnique({ where: { id }, include: { results: true } }),
    // Players, plus anyone already in this session so existing rows keep their selection.
    prisma.user.findMany({
      where: { OR: [{ role: "PLAYER" }, { results: { some: { sessionId: id } } }] },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    getCupsByDate(id),
  ]);
  if (!session) notFound();

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold">Edit session</h1>
      <SessionForm
        players={players}
        action={updateGameSession.bind(null, id)}
        submitLabel="Save changes"
        cupsByDate={sameDays}
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
