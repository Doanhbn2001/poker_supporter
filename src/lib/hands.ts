import "server-only";
import type { ParsedHand } from "@/lib/pokernow/parse";
import { addStats, emptyStats, type PlayStats } from "@/lib/pokernow/stats";
import { prisma } from "@/lib/prisma";

/** HandLog.players: every Poker Now player in the log and the app player they were linked to on import. */
export type HandLogPlayers = Record<string, { name: string; userId: string | null }>;

/** A Poker Now player as shown on the hand pages: the linked player's poker name, else the Poker Now name. */
export type HandPlayer = { name: string; userId: string | null };

type Viewer = { id: string; role: string };

/** The log owner's hole cards are private: only they and admins see them. */
export const canSeeHeroCards = (me: Viewer, log: { heroUserId: string | null }) =>
  me.role === "ADMIN" || (log.heroUserId !== null && log.heroUserId === me.id);

/** A game's hand log with display names resolved, or null if none was imported. */
export async function getHandLog(sessionId: string) {
  const log = await prisma.handLog.findUnique({
    where: { sessionId },
    select: {
      id: true,
      heroPokerNowId: true,
      heroUserId: true,
      players: true,
      stats: true,
      createdAt: true,
      uploadedBy: { select: { displayName: true } },
      _count: { select: { hands: true } },
    },
  });
  if (!log) return null;

  const raw = log.players as HandLogPlayers;
  const userIds = Object.values(raw).flatMap((p) => (p.userId ? [p.userId] : []));
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, displayName: true } });
  const displayName = new Map(users.map((u) => [u.id, u.displayName]));
  const players: Record<string, HandPlayer> = {};
  for (const [id, p] of Object.entries(raw)) {
    const userId = p.userId && displayName.has(p.userId) ? p.userId : null;
    players[id] = { name: userId ? displayName.get(userId)! : p.name, userId };
  }
  return { ...log, players, stats: (log.stats ?? {}) as Record<string, PlayStats> };
}

/** A player's playing-style stats summed over every imported log they were linked in, plus how many games. */
export async function getPlayerPlayStats(userId: string) {
  const logs = await prisma.handLog.findMany({ select: { players: true, stats: true } });
  let total = emptyStats();
  let games = 0;
  for (const log of logs) {
    const stats = (log.stats ?? {}) as Record<string, PlayStats>;
    const mine = Object.entries(log.players as HandLogPlayers).filter(([id, p]) => p.userId === userId && stats[id]);
    if (mine.length > 0) games++;
    for (const [id] of mine) total = addStats(total, stats[id]);
  }
  return { stats: total, games };
}

/** Stored hand JSON back as a ParsedHand, with the hero's cards only if the viewer may see them. */
export const toParsedHand = (hand: { data: unknown; heroCards: string[] }, showHero: boolean): ParsedHand => ({
  ...(hand.data as Omit<ParsedHand, "heroCards">),
  heroCards: showHero ? hand.heroCards : [],
});
