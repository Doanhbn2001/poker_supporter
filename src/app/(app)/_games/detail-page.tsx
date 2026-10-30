import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { deleteGameSession } from "@/app/actions/sessions";
import { Card, Money } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { GAME, type GameKind } from "@/lib/games";
import { DeleteGameButton } from "./delete-button";

/** A game's results. Opened under the wrong kind's URL (e.g. /cups/<cash id>), it redirects to the right one. */
export async function GameDetailPage({ id, type }: { id: string; type: GameKind }) {
  const me = await requireUser();
  const session = await prisma.gameSession.findUnique({
    where: { id },
    include: {
      createdBy: { select: { displayName: true } },
      champion: { select: { id: true, displayName: true } },
      results: { include: { user: { select: { id: true, displayName: true } } } },
    },
  });
  if (!session) notFound();
  if (session.type !== type) redirect(`${GAME[session.type].base}/${id}`);
  const game = GAME[type];

  const results = session.results
    .map((r) => ({ ...r, net: r.cashOut - r.buyIn }))
    .sort((a, b) => b.net - a.net);
  const totalIn = results.reduce((t, r) => t + r.buyIn, 0);
  const totalOut = results.reduce((t, r) => t + r.cashOut, 0);
  const canEdit = me.role === "ADMIN";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={game.base} className="text-sm text-neutral-500 hover:underline">
            ← All {game.plural.toLowerCase()}
          </Link>
          <h1 className="mt-1 text-xl font-semibold">
            {session.notes ?? formatDate(session.playedAt)}
            {session.location && <span className="text-neutral-500"> · {session.location}</span>}
          </h1>
          <p className="text-sm text-neutral-500">
            {session.notes && <>{formatDate(session.playedAt)} · </>}Logged by {session.createdBy.displayName}
          </p>
          {session.champion && (
            <p className="mt-1 text-sm">
              👑 Champion:{" "}
              <Link href={`/players/${session.champion.id}`} className="font-medium hover:underline">
                {session.champion.displayName}
              </Link>
            </p>
          )}
        </div>
        {canEdit && (
          <div className="flex items-center gap-4 text-sm">
            <Link href={`${game.base}/${id}/edit`} className="font-medium text-emerald-600 hover:underline">
              Edit
            </Link>
            <DeleteGameButton noun={game.noun} action={deleteGameSession.bind(null, id)} />
          </div>
        )}
      </div>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="text-left text-neutral-500">
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="px-4 py-2">Player</th>
              <th className="px-4 py-2 text-right">Buy-in</th>
              <th className="px-4 py-2 text-right">Cash-out</th>
              <th className="px-4 py-2 text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} className="border-b border-neutral-100 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium">
                  <Link href={`/players/${r.user.id}`} className="hover:underline">
                    {r.user.displayName}
                  </Link>
                </td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(r.buyIn)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatMoney(r.cashOut)}</td>
                <td className="px-4 py-2 text-right"><Money cents={r.net} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="font-medium">
            <tr>
              <td className="px-4 py-2">Total</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatMoney(totalIn)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatMoney(totalOut)}</td>
              <td className="px-4 py-2 text-right"><Money cents={totalOut - totalIn} /></td>
            </tr>
          </tfoot>
        </table>
      </Card>
      {totalOut !== totalIn && (
        <p className="text-sm text-neutral-500">
          Cash-outs and buy-ins differ by {formatMoney(Math.abs(totalOut - totalIn))}, so something may be missing.
        </p>
      )}
    </div>
  );
}
