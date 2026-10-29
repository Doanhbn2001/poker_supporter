import "server-only";
import { prisma } from "@/lib/prisma";

export type PlayerStats = {
  userId: string;
  displayName: string;
  sessions: number;
  /** Opening balance plus every session. */
  net: number;
  /** Sessions only; use this for per-session averages. */
  sessionNet: number;
  wins: number;
  /** Imported titles plus sessions won. */
  crowns: number;
  /** Null when the player has an opening balance but no sessions yet. */
  best: number | null;
  worst: number | null;
};

/** Per-player totals sorted by net profit. Includes anyone with sessions or an opening balance. */
export async function getLeaderboard(): Promise<PlayerStats[]> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      displayName: true,
      openingBalance: true,
      crowns: true,
      _count: { select: { championships: true } },
      results: { select: { buyIn: true, cashOut: true } },
    },
  });
  return users
    .filter((u) => u.results.length > 0 || u.openingBalance !== 0)
    .map((u) => {
      const nets = u.results.map((r) => r.cashOut - r.buyIn);
      const sessionNet = nets.reduce((a, b) => a + b, 0);
      return {
        userId: u.id,
        displayName: u.displayName,
        sessions: nets.length,
        net: u.openingBalance + sessionNet,
        sessionNet,
        wins: nets.filter((n) => n > 0).length,
        crowns: u.crowns + u._count.championships,
        best: nets.length > 0 ? Math.max(...nets) : null,
        worst: nets.length > 0 ? Math.min(...nets) : null,
      };
    })
    .sort((a, b) => b.net - a.net);
}

/** Sessions newest first, with a short summary of each. */
export async function getSessions(take?: number) {
  const sessions = await prisma.gameSession.findMany({
    orderBy: [{ playedAt: "desc" }, { createdAt: "desc" }],
    take,
    include: {
      results: { include: { user: { select: { displayName: true } } } },
      champion: { select: { displayName: true } },
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
      champion: s.champion?.displayName ?? null,
    };
  });
}

/** Number of sessions on each date (YYYY-MM-DD), optionally leaving one session out. */
export async function getCupsByDate(excludeId?: string): Promise<Record<string, number>> {
  const groups = await prisma.gameSession.groupBy({
    by: ["playedAt"],
    where: excludeId ? { id: { not: excludeId } } : undefined,
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.playedAt.toISOString().slice(0, 10), g._count._all]));
}

/**
 * `x` is the point's position and the chart's x-axis key: several sessions can share a date
 * (Cup 1 / Cup 2), so keying the axis by date would make the tooltip pick the wrong point.
 */
export type ProgressPoint = { x: number; date: string; label: string; [userId: string]: number | string };

/**
 * Running profit for every player, one point per session in date order.
 * A player's line starts from their opening balance and carries its last value through sessions they skipped.
 */
export async function getProgress() {
  const sessions = await prisma.gameSession.findMany({
    orderBy: [{ playedAt: "asc" }, { createdAt: "asc" }],
    select: {
      playedAt: true,
      notes: true,
      results: { select: { userId: true, buyIn: true, cashOut: true } },
    },
  });
  const users = await prisma.user.findMany({ select: { id: true, displayName: true, openingBalance: true } });

  const running: Record<string, number> = Object.fromEntries(
    users.filter((u) => u.openingBalance !== 0).map((u) => [u.id, u.openingBalance]),
  );
  const points: ProgressPoint[] = sessions.map((s, x) => {
    for (const r of s.results) running[r.userId] = (running[r.userId] ?? 0) + r.cashOut - r.buyIn;
    return { ...running, x, date: s.playedAt.toISOString().slice(0, 10), label: s.notes ?? "" };
  });

  const players = users
    .filter((u) => u.id in running)
    .map((u) => ({ id: u.id, name: u.displayName, net: running[u.id] }))
    .sort((a, b) => b.net - a.net);
  return { points, players };
}

/** One player's sessions in date order, with running profit starting from `openingBalance`. */
export async function getPlayerHistory(userId: string, openingBalance = 0) {
  const results = await prisma.result.findMany({
    where: { userId },
    select: {
      buyIn: true,
      cashOut: true,
      session: { select: { id: true, playedAt: true, location: true, notes: true, createdAt: true } },
    },
  });
  results.sort(
    (a, b) =>
      a.session.playedAt.getTime() - b.session.playedAt.getTime() ||
      a.session.createdAt.getTime() - b.session.createdAt.getTime(),
  );

  let total = openingBalance;
  return results.map((r, x) => {
    const net = r.cashOut - r.buyIn;
    total += net;
    return {
      x,
      sessionId: r.session.id,
      date: r.session.playedAt.toISOString().slice(0, 10),
      label: r.session.notes ?? "",
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
