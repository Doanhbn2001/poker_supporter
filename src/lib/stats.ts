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

type NetResult = { userId: string; displayName: string; net: number };

function summarize(results: NetResult[]): PlayerStats[] {
  const byPlayer = new Map<string, PlayerStats>();
  for (const r of results) {
    const s = byPlayer.get(r.userId) ?? {
      userId: r.userId,
      displayName: r.displayName,
      sessions: 0,
      net: 0,
      wins: 0,
      best: r.net,
      worst: r.net,
    };
    s.sessions += 1;
    s.net += r.net;
    if (r.net > 0) s.wins += 1;
    s.best = Math.max(s.best, r.net);
    s.worst = Math.min(s.worst, r.net);
    byPlayer.set(r.userId, s);
  }
  return [...byPlayer.values()].sort((a, b) => b.net - a.net);
}

/** Per-player totals across every session, sorted by net profit. */
export async function getLeaderboard(): Promise<PlayerStats[]> {
  const results = await prisma.result.findMany({
    select: { userId: true, buyIn: true, cashOut: true, user: { select: { displayName: true } } },
  });
  return summarize(
    results.map((r) => ({ userId: r.userId, displayName: r.user.displayName, net: r.cashOut - r.buyIn })),
  );
}

/** Sessions newest first, with a short summary of each. */
export async function getSessions(take?: number) {
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

export type ProgressPoint = { date: string; [userId: string]: number | string };

/**
 * Running profit for every player, one point per session in date order.
 * A player's line carries its last value through sessions they skipped.
 */
export async function getProgress() {
  const sessions = await prisma.gameSession.findMany({
    orderBy: [{ playedAt: "asc" }, { createdAt: "asc" }],
    select: {
      playedAt: true,
      results: { select: { userId: true, buyIn: true, cashOut: true } },
    },
  });
  const users = await prisma.user.findMany({ select: { id: true, displayName: true } });

  const running: Record<string, number> = {};
  const points: ProgressPoint[] = sessions.map((s) => {
    for (const r of s.results) running[r.userId] = (running[r.userId] ?? 0) + r.cashOut - r.buyIn;
    return { date: s.playedAt.toISOString().slice(0, 10), ...running };
  });

  const players = users
    .filter((u) => u.id in running)
    .map((u) => ({ id: u.id, name: u.displayName, net: running[u.id] }))
    .sort((a, b) => b.net - a.net);
  return { points, players };
}

/** One player's sessions in date order, with running profit. */
export async function getPlayerHistory(userId: string) {
  const results = await prisma.result.findMany({
    where: { userId },
    select: {
      buyIn: true,
      cashOut: true,
      session: { select: { id: true, playedAt: true, location: true, createdAt: true } },
    },
  });
  results.sort(
    (a, b) =>
      a.session.playedAt.getTime() - b.session.playedAt.getTime() ||
      a.session.createdAt.getTime() - b.session.createdAt.getTime(),
  );

  let total = 0;
  return results.map((r) => {
    const net = r.cashOut - r.buyIn;
    total += net;
    return {
      sessionId: r.session.id,
      date: r.session.playedAt.toISOString().slice(0, 10),
      location: r.session.location,
      buyIn: r.buyIn,
      cashOut: r.cashOut,
      net,
      total,
    };
  });
}

export function statsFromHistory(history: { net: number }[]) {
  if (history.length === 0) return null;
  const nets = history.map((h) => h.net);

  // Current streak: consecutive wins (or losses) counting back from the latest session.
  let streak = 0;
  for (let i = nets.length - 1; i >= 0; i--) {
    const sign = Math.sign(nets[i]);
    if (sign === 0 || (streak !== 0 && sign !== Math.sign(streak))) break;
    streak += sign;
  }

  return {
    sessions: nets.length,
    net: nets.reduce((a, b) => a + b, 0),
    wins: nets.filter((n) => n > 0).length,
    best: Math.max(...nets),
    worst: Math.min(...nets),
    lastFive: nets.slice(-5).reduce((a, b) => a + b, 0),
    streak,
  };
}
