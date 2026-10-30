import "server-only";
import type { GameKind } from "@/lib/games";
import { prisma } from "@/lib/prisma";

export type PlayerStats = {
  userId: string;
  displayName: string;
  /** Games counted in this view. */
  sessions: number;
  /** Profit in this view: games plus the opening balance where it applies (cash and overall). */
  net: number;
  /** Games only; use this for per-game averages. */
  sessionNet: number;
  wins: number;
  /** Imported titles plus cups won. */
  crowns: number;
  /** Null when the player has no games in this view. */
  best: number | null;
  worst: number | null;
  cups: number;
  cashGames: number;
  /** What the player can still withdraw from the fund: overall profit + deposits - withdrawals. */
  wallet: number;
};

export type Leaderboards = { all: PlayerStats[]; tour: PlayerStats[]; cash: PlayerStats[] };

/**
 * Per-player totals for the three leaderboards, each sorted by profit:
 * `tour` counts cups only, `cash` cash games plus the opening balance, `all` everything.
 */
export async function getLeaderboards(): Promise<Leaderboards> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      displayName: true,
      openingBalance: true,
      crowns: true,
      _count: { select: { championships: true } },
      results: { select: { buyIn: true, cashOut: true, session: { select: { type: true } } } },
      transactions: { select: { kind: true, amount: true } },
    },
  });

  const views = { all: [] as PlayerStats[], tour: [] as PlayerStats[], cash: [] as PlayerStats[] };
  for (const u of users) {
    const games = u.results.map((r) => ({ type: r.session.type, net: r.cashOut - r.buyIn }));
    const fund = u.transactions.reduce((t, x) => t + (x.kind === "DEPOSIT" ? x.amount : -x.amount), 0);
    const cups = games.filter((g) => g.type === "CUP").length;
    const cashGames = games.length - cups;
    const overall = u.openingBalance + games.reduce((t, g) => t + g.net, 0);

    const stats = (nets: number[], opening: number): PlayerStats => {
      const sessionNet = nets.reduce((a, b) => a + b, 0);
      return {
        userId: u.id,
        displayName: u.displayName,
        sessions: nets.length,
        net: opening + sessionNet,
        sessionNet,
        wins: nets.filter((n) => n > 0).length,
        crowns: u.crowns + u._count.championships,
        best: nets.length > 0 ? Math.max(...nets) : null,
        worst: nets.length > 0 ? Math.min(...nets) : null,
        cups,
        cashGames,
        wallet: overall + fund,
      };
    };

    if (games.length > 0 || u.openingBalance !== 0 || u.transactions.length > 0) {
      views.all.push(stats(games.map((g) => g.net), u.openingBalance));
    }
    if (cups > 0) views.tour.push(stats(games.filter((g) => g.type === "CUP").map((g) => g.net), 0));
    if (cashGames > 0 || u.openingBalance !== 0) {
      views.cash.push(stats(games.filter((g) => g.type === "CASH").map((g) => g.net), u.openingBalance));
    }
  }
  for (const list of Object.values(views)) list.sort((a, b) => b.net - a.net);
  return views;
}

/** Games newest first (optionally of one kind), with a short summary of each. */
export async function getSessions({ take, type }: { take?: number; type?: GameKind } = {}) {
  const sessions = await prisma.gameSession.findMany({
    where: type ? { type } : undefined,
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
      type: s.type,
      playedAt: s.playedAt,
      location: s.location,
      name: s.notes,
      pot: s.results.reduce((sum, r) => sum + r.buyIn, 0),
      winner: results[0],
      players: results.length,
      champion: s.champion?.displayName ?? null,
    };
  });
}

/** Number of games of one kind on each date (YYYY-MM-DD), optionally leaving one game out. */
export async function getGamesByDate(type: GameKind, excludeId?: string): Promise<Record<string, number>> {
  const groups = await prisma.gameSession.groupBy({
    by: ["playedAt"],
    where: { type, ...(excludeId && { id: { not: excludeId } }) },
    _count: { _all: true },
  });
  return Object.fromEntries(groups.map((g) => [g.playedAt.toISOString().slice(0, 10), g._count._all]));
}

/**
 * `x` is the point's position and the chart's x-axis key: several games can share a date
 * (two cups on one day), so keying the axis by date would make the tooltip pick the wrong point.
 */
export type ProgressPoint = { x: number; date: string; label: string; [userId: string]: number | string };

/**
 * Running profit for every player over the games of one kind: a "Start" point, then one point per game
 * in date order. Every line starts at the Start point (0 for tour, the opening balance for cash) and
 * carries its last value through games the player skipped.
 */
export async function getProgress(type: GameKind) {
  const [sessions, users] = await Promise.all([
    prisma.gameSession.findMany({
      where: { type },
      orderBy: [{ playedAt: "asc" }, { createdAt: "asc" }],
      select: { playedAt: true, notes: true, results: { select: { userId: true, buyIn: true, cashOut: true } } },
    }),
    prisma.user.findMany({ select: { id: true, displayName: true, openingBalance: true } }),
  ]);

  // Everyone who played this kind (plus, for cash, anyone carrying an opening balance) starts at Start.
  const played = new Set(sessions.flatMap((s) => s.results.map((r) => r.userId)));
  const opening = (u: (typeof users)[number]) => (type === "CASH" ? u.openingBalance : 0);
  const running: Record<string, number> = Object.fromEntries(
    users.filter((u) => played.has(u.id) || opening(u) !== 0).map((u) => [u.id, opening(u)]),
  );
  const points: ProgressPoint[] = [{ ...running, x: 0, date: "", label: "Start" }];
  sessions.forEach((s, i) => {
    for (const r of s.results) running[r.userId] += r.cashOut - r.buyIn;
    points.push({ ...running, x: i + 1, date: s.playedAt.toISOString().slice(0, 10), label: s.notes ?? "" });
  });

  const players = users
    .filter((u) => u.id in running)
    .map((u) => ({ id: u.id, name: u.displayName, net: running[u.id] }))
    .sort((a, b) => b.net - a.net);
  return { points, players };
}

/** One player's games of one kind in date order, with running profit starting from `start`. */
export async function getPlayerHistory(userId: string, type: GameKind, start = 0) {
  const results = await prisma.result.findMany({
    where: { userId, session: { type } },
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

  let total = start;
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

  // Current streak: consecutive wins (or losses) counting back from the latest game.
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

/** The fund: every deposit/withdrawal newest first, and the cash the treasurer should be holding. */
export async function getFund() {
  const transactions = await prisma.transaction.findMany({
    orderBy: [{ happenedAt: "desc" }, { createdAt: "desc" }],
    include: { user: { select: { id: true, displayName: true } } },
  });
  const held = transactions.reduce((t, x) => t + (x.kind === "DEPOSIT" ? x.amount : -x.amount), 0);
  return { transactions, held };
}
