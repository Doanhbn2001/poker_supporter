import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteHandLog } from "@/app/actions/hands";
import { CollapsibleSection } from "@/components/collapsible-section";
import { PlayInsights, PlayStatsTable, type PlayStatsRow } from "@/components/play-stats";
import { CardRow } from "@/components/playing-card";
import { Card, TableCard } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { GAME, type GameKind } from "@/lib/games";
import { canSeeHeroCards, getHandLog, toParsedHand } from "@/lib/hands";
import { formatChips } from "@/lib/pokernow/replay";
import { bigBlind, handNet } from "@/lib/pokernow/stats";
import { prisma } from "@/lib/prisma";
import { DeleteGameButton } from "./delete-button";

/** List views: everything by hand number, the biggest pots, or one of the "worth reviewing" filters. */
const VIEWS = {
  all: "All hands",
  pots: "Biggest pots",
  allin: "All-ins",
  showdown: "Showdowns",
  losses: "My biggest losses",
} as const;
export type HandsView = keyof typeof VIEWS;

/** "1:05" hours:minutes since the first hand. */
const elapsed = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

const bbs = (chips: number, bb: number) => {
  const v = chips / bb;
  return `${Math.abs(v) >= 10 ? Math.round(v) : v.toFixed(1)} bb`;
};

export async function HandsPage({ id, type, view: viewParam }: { id: string; type: GameKind; view?: string }) {
  const me = await requireUser();
  const session = await prisma.gameSession.findUnique({ where: { id }, select: { type: true, notes: true, playedAt: true } });
  if (!session) notFound();
  if (session.type !== type) redirect(`${GAME[session.type].base}/${id}/hands`);
  const base = `${GAME[type].base}/${id}`;
  const isAdmin = me.role === "ADMIN";
  const log = await getHandLog(id);

  const header = (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link href={base} className="text-sm text-neutral-500 hover:underline">
          ← {session.notes ?? formatDate(session.playedAt)}
        </Link>
        <h1 className="mt-1 text-xl font-semibold">Hands</h1>
        {log && (
          <p className="text-sm text-neutral-500">
            {log._count.hands} hands from Poker Now · imported by {log.uploadedBy.displayName}
            {log.heroPokerNowId && <> · log owner {log.players[log.heroPokerNowId]?.name}</>}
          </p>
        )}
      </div>
      {isAdmin && (
        <div className="flex items-center gap-4 text-sm">
          <Link href={`${base}/hands/import`} className="font-medium text-emerald-600 hover:underline">
            {log ? "Re-import" : "Import Poker Now log"}
          </Link>
          {log && <DeleteGameButton noun="hand log" action={deleteHandLog.bind(null, id)} />}
        </div>
      )}
    </div>
  );

  if (!log) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="text-center text-neutral-500">No hands imported for this game yet.</Card>
      </div>
    );
  }

  // The viewer's seat in this log, if they were linked on import.
  const mine = Object.entries(log.players).find(([, p]) => p.userId === me.id)?.[0] ?? null;
  const view: HandsView = viewParam && viewParam in VIEWS && (viewParam !== "losses" || mine) ? (viewParam as HandsView) : "all";
  const showHero = canSeeHeroCards(me, log) && !!log.heroPokerNowId;
  const name = (pn: string) => log.players[pn]?.name ?? pn;

  const stored = await prisma.hand.findMany({
    where: { logId: log.id },
    orderBy: { number: "asc" },
    select: { number: true, startedAt: true, pot: true, showdown: true, heroCards: true, data: true },
  });
  const first = stored[0]?.startedAt.getTime() ?? 0;
  let rows = stored.map((row) => {
    const hand = toParsedHand(row, showHero);
    const bb = bigBlind(hand);
    return {
      ...row,
      hand,
      bb,
      allIn: hand.events.some((e) => "allIn" in e && e.allIn),
      myNet: mine ? handNet(hand)[mine] ?? null : null,
    };
  });
  if (view === "pots") rows = [...rows].sort((a, b) => b.pot / b.bb - a.pot / a.bb);
  if (view === "allin") rows = rows.filter((r) => r.allIn);
  if (view === "showdown") rows = rows.filter((r) => r.showdown);
  if (view === "losses") rows = rows.filter((r) => (r.myNet ?? 0) < 0).sort((a, b) => a.myNet! / a.bb - b.myNet! / b.bb).slice(0, 30);

  const statRows: PlayStatsRow[] = Object.entries(log.stats)
    .map(([pn, stats]) => ({
      id: pn,
      name: name(pn),
      href: log.players[pn]?.userId ? `/players/${log.players[pn].userId}` : undefined,
      stats,
    }))
    .sort((a, b) => b.stats.hands - a.stats.hands);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 ${
      active ? "border-emerald-600 bg-emerald-600 text-white" : "border-neutral-300 hover:border-emerald-600 dark:border-neutral-700"
    }`;

  return (
    <div className="space-y-6">
      {header}

      {statRows.length > 0 && (
        <CollapsibleSection title="Playing style" className="space-y-4">
          <PlayStatsTable rows={statRows} />
          <PlayInsights rows={statRows} />
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Hands" className="space-y-3">
        <div className="flex flex-wrap gap-2 text-sm">
          {(Object.keys(VIEWS) as HandsView[])
            .filter((v) => v !== "losses" || mine)
            .map((v) => (
              <Link key={v} href={v === "all" ? `${base}/hands` : `${base}/hands?view=${v}`} className={chip(view === v)}>
                {VIEWS[v]}
              </Link>
            ))}
        </div>
        {view === "losses" && (
          <p className="text-sm text-neutral-500">
            Những hand bạn mất nhiều nhất (tính theo big blind). Xem lại từng quyết định: lúc call, hãy so equity của bạn
            với pot odds hiện trên replay.
          </p>
        )}

        {rows.length === 0 ? (
          <Card className="text-center text-neutral-500">No hands match.</Card>
        ) : (
          <TableCard className="max-h-[max(20rem,calc(100dvh_-_16rem))]">
            <table className="w-full text-sm">
              <thead className="text-left text-neutral-500">
                <tr className="border-b border-neutral-200 dark:border-neutral-800">
                  <th className="px-4 py-2">#</th>
                  <th className="hidden px-4 py-2 md:table-cell">Time</th>
                  {showHero && <th className="px-4 py-2">{name(log.heroPokerNowId!)}</th>}
                  <th className="px-4 py-2">Board</th>
                  <th className="px-4 py-2">Winner</th>
                  {mine && <th className="px-4 py-2 text-right">You</th>}
                  <th className="px-4 py-2 text-right">Pot</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ number, startedAt, pot, showdown, hand, bb, allIn, myNet }) => {
                  const winners = [...new Set(hand.events.flatMap((e) => (e.kind === "collect" ? [e.player] : [])))];
                  const winning = hand.events.find((e) => e.kind === "collect" && e.handName);
                  const href = `${base}/hands/${number}`;
                  return (
                    <tr
                      key={number}
                      className="border-b border-neutral-100 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800/50"
                    >
                      <td className="px-4 py-2 font-medium">
                        <Link href={href} className="text-emerald-600 hover:underline">
                          #{number}
                        </Link>
                        {allIn && <div className="text-[10px] font-semibold tracking-wide text-amber-600 uppercase">all-in</div>}
                      </td>
                      <td className="hidden px-4 py-2 text-neutral-500 tabular-nums md:table-cell">
                        {elapsed(startedAt.getTime() - first)}
                      </td>
                      {showHero && (
                        <td className="px-4 py-2">
                          <Link href={href}>
                            <CardRow cards={hand.heroCards} small />
                          </Link>
                        </td>
                      )}
                      <td className="px-4 py-2">
                        <Link href={href}>
                          {hand.board.length > 0 ? <CardRow cards={hand.board} small /> : <span className="text-neutral-500">—</span>}
                        </Link>
                      </td>
                      <td className="px-4 py-2">
                        {winners.map(name).join(", ")}
                        {winning?.kind === "collect" && <div className="text-xs text-neutral-500">{winning.handName}</div>}
                      </td>
                      {mine && (
                        <td
                          className={`px-4 py-2 text-right tabular-nums ${
                            myNet === null ? "" : myNet > 0 ? "text-emerald-600" : myNet < 0 ? "text-red-600" : "text-neutral-500"
                          }`}
                        >
                          {myNet === null ? (
                            <span className="text-neutral-500">—</span>
                          ) : (
                            <>
                              {myNet > 0 ? "+" : ""}
                              {formatChips(myNet)}
                              {myNet !== 0 && <div className="text-xs opacity-70">{bbs(myNet, bb)}</div>}
                            </>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-2 text-right tabular-nums">
                        {formatChips(pot)}
                        <div className="text-xs text-neutral-500">
                          {bbs(pot, bb)}
                          {showdown && " · showdown"}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableCard>
        )}
      </CollapsibleSection>
    </div>
  );
}
