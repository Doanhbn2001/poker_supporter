import Link from "next/link";
import { notFound } from "next/navigation";
import { CumulativeChart, SessionResultsChart } from "@/components/charts/player-charts";
import { CollapsibleSection } from "@/components/collapsible-section";
import { Card, Money, TableCard } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { GAME, type GameKind } from "@/lib/games";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getPlayerHistory, statsFromHistory } from "@/lib/stats";

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="py-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className="mt-1 text-lg font-semibold">{children}</div>
    </Card>
  );
}

type History = Awaited<ReturnType<typeof getPlayerHistory>>;

/** Stats, charts and history for one kind of game. Cash includes the opening balance, cups don't. */
function KindSection({ kind, history, opening }: { kind: GameKind; history: History; opening: number }) {
  const game = GAME[kind];
  const stats = statsFromHistory(history);
  const title = game.plural;

  if (!stats) {
    return (
      <CollapsibleSection title={title}>
        {opening !== 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Profit"><Money cents={opening} /></Stat>
            <Stat label="Opening balance"><Money cents={opening} /></Stat>
          </div>
        ) : (
          <Card className="text-center text-neutral-500">No {game.plural.toLowerCase()} yet.</Card>
        )}
      </CollapsibleSection>
    );
  }

  const streak = stats.streak;
  return (
    <CollapsibleSection title={title} className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Profit">
          <Money cents={opening + stats.net} />
          {opening !== 0 && (
            <div className="text-xs font-normal text-neutral-500">
              incl. <Money cents={opening} /> opening balance
            </div>
          )}
        </Stat>
        <Stat label={game.plural}>{stats.sessions}</Stat>
        <Stat label="Win rate">{Math.round((stats.wins / stats.sessions) * 100)}%</Stat>
        <Stat label={`Avg / ${game.noun}`}><Money cents={Math.round(stats.net / stats.sessions)} /></Stat>
        <Stat label={`Best ${game.noun}`}><Money cents={stats.best} /></Stat>
        <Stat label={`Worst ${game.noun}`}><Money cents={stats.worst} /></Stat>
        <Stat label={`Last 5 ${game.plural.toLowerCase()}`}><Money cents={stats.lastFive} /></Stat>
        <Stat label="Current streak">
          {streak === 0
            ? "None"
            : `${Math.abs(streak)} ${streak > 0 ? "win" : "loss"}${Math.abs(streak) > 1 ? (streak > 0 ? "s" : "es") : ""}`}
        </Stat>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 text-sm font-medium text-neutral-500">Profit over time</h3>
          <CumulativeChart data={history} />
        </Card>
        <Card>
          <h3 className="mb-2 text-sm font-medium text-neutral-500">Result per {game.noun}</h3>
          <SessionResultsChart data={history} />
        </Card>
      </div>

      <TableCard>
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="px-4 py-2">{game.Noun}</th>
              <th className="px-4 py-2 text-right">Buy-in</th>
              <th className="px-4 py-2 text-right">Cash-out</th>
              <th className="px-4 py-2 text-right">Net</th>
              <th className="px-4 py-2 text-right">Running total</th>
            </tr>
          </thead>
          <tbody>
            {[...history].reverse().map((h) => (
              <tr key={h.sessionId} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-2">
                  <Link href={`${game.base}/${h.sessionId}`} className="hover:underline">
                    {h.label || formatDate(new Date(`${h.date}T00:00:00Z`))}
                  </Link>
                  {h.location && <span className="text-neutral-500"> · {h.location}</span>}
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(h.buyIn)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(h.cashOut)}</td>
                <td className="px-4 py-2 text-right"><Money cents={h.net} /></td>
                <td className="px-4 py-2 text-right"><Money cents={h.total} /></td>
              </tr>
            ))}
            {opening !== 0 && (
              <tr className="text-neutral-500">
                <td className="px-4 py-2" colSpan={3}>Opening balance</td>
                <td className="px-4 py-2 text-right"><Money cents={opening} /></td>
                <td className="px-4 py-2 text-right"><Money cents={opening} /></td>
              </tr>
            )}
          </tbody>
        </table>
      </TableCard>
    </CollapsibleSection>
  );
}

export default async function PlayerPage({ params }: PageProps<"/players/[id]">) {
  const { id } = await params;
  await requireUser();
  const player = await prisma.user.findUnique({
    where: { id },
    select: {
      displayName: true,
      username: true,
      motto: true,
      crowns: true,
      openingBalance: true,
      _count: { select: { championships: true } },
      transactions: { orderBy: [{ happenedAt: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!player) notFound();

  const opening = player.openingBalance;
  const crowns = player.crowns + player._count.championships;
  const [tour, cash] = await Promise.all([getPlayerHistory(id, "CUP"), getPlayerHistory(id, "CASH", opening)]);

  const profit = opening + [...tour, ...cash].reduce((t, h) => t + h.net, 0);
  const fund = player.transactions.reduce((t, x) => t + (x.kind === "DEPOSIT" ? x.amount : -x.amount), 0);
  const wallet = profit + fund;

  return (
    <div className="space-y-8">
      <div>
        <Link href="/players" className="text-sm text-neutral-500 hover:underline">
          ← All players
        </Link>
        <h1 className="mt-1 text-xl font-semibold">{player.displayName}</h1>
        <p className="text-sm text-neutral-500">
          @{player.username}
          {crowns > 0 && ` · 👑 ${crowns} crown${crowns > 1 ? "s" : ""}`}
        </p>
        {player.motto && <p className="mt-2 text-sm italic text-neutral-600 dark:text-neutral-300">“{player.motto}”</p>}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Wallet">
          <Money cents={wallet} />
          <div className="text-xs font-normal text-neutral-500">
            {wallet > 0 ? "can withdraw" : wallet < 0 ? "owes the fund" : "settled"}
          </div>
        </Stat>
        <Stat label="Overall profit"><Money cents={profit} /></Stat>
        <Stat label="Tournaments">{tour.length}</Stat>
        <Stat label="Cash games">{cash.length}</Stat>
      </div>

      <KindSection kind="CUP" history={tour} opening={0} />
      <KindSection kind="CASH" history={cash} opening={opening} />

      <CollapsibleSection title="Deposits & withdrawals">
        {player.transactions.length === 0 ? (
          <Card className="text-center text-neutral-500">None yet.</Card>
        ) : (
          <TableCard>
            <table className="w-full text-sm">
              <tbody>
                {player.transactions.map((t) => (
                  <tr key={t.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                    <td className="px-4 py-2 whitespace-nowrap">{formatDate(t.happenedAt)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">
                      {t.kind === "DEPOSIT" ? "Deposit" : "Withdraw"}{" "}
                      <span className="font-medium tabular-nums">{formatMoney(t.amount)}</span>
                    </td>
                    <td className="px-4 py-2 text-neutral-500">{t.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableCard>
        )}
      </CollapsibleSection>
    </div>
  );
}
