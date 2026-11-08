"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import type { HandLogPlayers } from "@/lib/hands";
import { requireAdmin } from "@/lib/dal";
import { GAME } from "@/lib/games";
import { parsePokerNowLog } from "@/lib/pokernow/parse";
import { computeStats } from "@/lib/pokernow/stats";
import { prisma } from "@/lib/prisma";

export type HandLogFormState = { error?: string } | undefined;

/** Keep in step with serverActions.bodySizeLimit in next.config.ts (which also counts form overhead). */
const MAX_LOG_CHARS = 4_500_000;

/**
 * Imports a Poker Now CSV log into a game, replacing any log it already had. The form sends the CSV text as
 * `csv`, the log owner's Poker Now id as `hero`, and one `user:<pokerNowId>` field per player (a user id or "").
 */
export async function importHandLog(
  sessionId: string,
  _state: HandLogFormState,
  formData: FormData,
): Promise<HandLogFormState> {
  const me = await requireAdmin();
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { type: true } });
  if (!session) return { error: "Game not found." };

  const csv = String(formData.get("csv") ?? "");
  if (!csv) return { error: "Choose a Poker Now log file." };
  if (csv.length > MAX_LOG_CHARS) return { error: "That log is too large to import." };

  const parsed = parsePokerNowLog(csv);
  if (parsed.errors.length > 0) return { error: parsed.errors.slice(0, 3).join(" ") };

  const players: HandLogPlayers = {};
  for (const p of parsed.players) {
    players[p.id] = { name: p.name, userId: String(formData.get(`user:${p.id}`) ?? "") || null };
  }
  const userIds = [...new Set(Object.values(players).flatMap((p) => (p.userId ? [p.userId] : [])))];
  const known = await prisma.user.count({ where: { id: { in: userIds } } });
  if (known !== userIds.length) return { error: "Unknown player selected." };
  const linked = Object.values(players).filter((p) => p.userId);
  if (new Set(linked.map((p) => p.userId)).size !== linked.length) {
    return { error: "Each app player can only be linked to one Poker Now player." };
  }

  const hero = String(formData.get("hero") ?? "") || null;
  if (hero && !(hero in players)) return { error: "The log owner must be one of the players in the log." };

  // The same hands in another game means this log was already imported there.
  const clash = await prisma.hand.findFirst({
    where: { pokerNowId: { in: parsed.hands.map((h) => h.pokerNowId) }, log: { sessionId: { not: sessionId } } },
    select: { log: { select: { session: { select: { notes: true } } } } },
  });
  if (clash) return { error: `These hands are already imported into “${clash.log.session.notes ?? "another game"}”.` };

  await prisma.$transaction([
    prisma.handLog.deleteMany({ where: { sessionId } }),
    prisma.handLog.create({
      data: {
        sessionId,
        heroPokerNowId: hero,
        heroUserId: hero ? players[hero].userId : null,
        players,
        stats: computeStats(parsed.hands),
        uploadedById: me.id,
        hands: {
          createMany: {
            data: parsed.hands.map(({ heroCards, ...hand }) => ({
              number: hand.number,
              pokerNowId: hand.pokerNowId,
              startedAt: new Date(hand.startedAt),
              pot: hand.pot,
              showdown: hand.showdown,
              heroCards,
              data: hand as unknown as Prisma.InputJsonValue,
            })),
          },
        },
      },
    }),
    // Remember who is who for the next import.
    ...Object.entries(players).flatMap(([pokerNowId, p]) =>
      p.userId
        ? [
            prisma.pokerNowAlias.upsert({
              where: { pokerNowId },
              create: { pokerNowId, userId: p.userId, lastName: p.name },
              update: { userId: p.userId, lastName: p.name },
            }),
          ]
        : [],
    ),
  ]);

  const base = `${GAME[session.type].base}/${sessionId}`;
  revalidatePath(base, "layout");
  redirect(`${base}/hands`);
}

export async function deleteHandLog(sessionId: string) {
  await requireAdmin();
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { type: true } });
  if (!session) throw new Error("Game not found.");
  await prisma.handLog.deleteMany({ where: { sessionId } });
  const base = `${GAME[session.type].base}/${sessionId}`;
  revalidatePath(base, "layout");
  redirect(base);
}
