import "server-only";
import { prisma } from "@/lib/prisma";

export type PlayerStats = {
  userId: string;
  displayName: string;
  sessions: number;
  net: number;
  wins: number;
  best: number;
  worst: number;
};

/** Per-player totals across every session, sorted by net profit. */
export async function getLeaderboard(): Promise<PlayerStats[]> {
  const results = await prisma.result.findMany({
    select: { userId: true, buyIn: true, cashOut: true, user: { select: { displayName: true } } },
  });

  const byPlayer = new Map<string, PlayerStats>();
  for (const r of results) {
    const net = r.cashOut - r.buyIn;
    const s = byPlayer.get(r.userId) ?? {
      userId: r.userId,
      displayName: r.user.displayName,
      sessions: 0,
      net: 0,
      wins: 0,
      best: net,
      worst: net,
    };
    s.sessions += 1;
    s.net += net;
    if (net > 0) s.wins += 1;
    s.best = Math.max(s.best, net);
    s.worst = Math.min(s.worst, net);
    byPlayer.set(r.userId, s);
  }
  return [...byPlayer.values()].sort((a, b) => b.net - a.net);
}

export async function getRecentSessions(take = 10) {
  const sessions = await prisma.gameSession.findMany({
    orderBy: [{ playedAt: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      results: { include: { user: { select: { displayName: true } } } },
    },
  });
  return sessions.map((s) => {
    const results = s.results
      .map((r) => ({ name: r.user.displayName, net: r.cashOut - r.buyIn }))
      .sort((a, b) => b.net - a.net);
    return {
      id: s.id,
      playedAt: s.playedAt,
      location: s.location,
      pot: s.results.reduce((sum, r) => sum + r.buyIn, 0),
      winner: results[0],
      players: results.length,
    };
  });
}
