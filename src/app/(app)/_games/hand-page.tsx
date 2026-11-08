import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HandReplay } from "@/components/hand-replay";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { GAME, type GameKind } from "@/lib/games";
import { canSeeHeroCards, getHandLog, toParsedHand } from "@/lib/hands";
import { prisma } from "@/lib/prisma";

export async function HandPage({ id, type, number }: { id: string; type: GameKind; number: string }) {
  const me = await requireUser();
  const n = Number(number);
  if (!Number.isInteger(n)) notFound();
  const session = await prisma.gameSession.findUnique({ where: { id }, select: { type: true, notes: true, playedAt: true } });
  if (!session) notFound();
  if (session.type !== type) redirect(`${GAME[session.type].base}/${id}/hands/${n}`);
  const log = await getHandLog(id);
  if (!log) notFound();

  const [row, prev, next] = await Promise.all([
    prisma.hand.findUnique({ where: { logId_number: { logId: log.id, number: n } } }),
    prisma.hand.findFirst({ where: { logId: log.id, number: { lt: n } }, orderBy: { number: "desc" }, select: { number: true } }),
    prisma.hand.findFirst({ where: { logId: log.id, number: { gt: n } }, orderBy: { number: "asc" }, select: { number: true } }),
  ]);
  if (!row) notFound();

  // The log owner's cards never leave the server for viewers who may not see them.
  const showHero = canSeeHeroCards(me, log);
  const hand = toParsedHand(row, showHero);
  const base = `${GAME[type].base}/${id}/hands`;

  return (
    <div className="space-y-4">
      <div>
        <Link href={base} className="text-sm text-neutral-500 hover:underline">
          ← All hands · {session.notes ?? formatDate(session.playedAt)}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Hand #{hand.number}</h1>
        <p className="text-sm text-neutral-500">{hand.game}</p>
      </div>
      <HandReplay
        key={hand.number}
        hand={hand}
        players={log.players}
        hero={log.heroPokerNowId}
        prevHref={prev ? `${base}/${prev.number}` : null}
        nextHref={next ? `${base}/${next.number}` : null}
      />
    </div>
  );
}
