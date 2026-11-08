import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { importHandLog } from "@/app/actions/hands";
import { requireAdmin } from "@/lib/dal";
import { formatDate } from "@/lib/dates";
import { GAME, type GameKind } from "@/lib/games";
import { prisma } from "@/lib/prisma";
import { HandImportForm } from "./hand-import-form";

export async function HandImportPage({ id, type }: { id: string; type: GameKind }) {
  await requireAdmin();
  const [session, users, aliases, existing] = await Promise.all([
    prisma.gameSession.findUnique({ where: { id }, select: { type: true, notes: true, playedAt: true } }),
    prisma.user.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
    prisma.pokerNowAlias.findMany({ select: { pokerNowId: true, userId: true } }),
    prisma.hand.count({ where: { log: { sessionId: id } } }),
  ]);
  if (!session) notFound();
  if (session.type !== type) redirect(`${GAME[session.type].base}/${id}/hands/import`);

  return (
    <div className="max-w-3xl">
      <Link href={`${GAME[type].base}/${id}`} className="text-sm text-neutral-500 hover:underline">
        ← {session.notes ?? formatDate(session.playedAt)}
      </Link>
      <h1 className="mt-1 mb-6 text-xl font-semibold">Import Poker Now log</h1>
      <HandImportForm
        users={users}
        aliases={Object.fromEntries(aliases.map((a) => [a.pokerNowId, a.userId]))}
        existingHands={existing}
        action={importHandLog.bind(null, id)}
      />
    </div>
  );
}
