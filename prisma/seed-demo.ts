import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Fills an EMPTY local database with fake players, tournaments, cash games and fund moves, so contributors
// can develop without the group's real data. Refuses to touch a database that already has games.
//   npm run db:seed (admin first) && npm run db:seed-demo

const PASSWORD = "demo1234";
const PLAYERS = ["An", "Bình", "Cường", "Dũng", "Giang", "Hoà", "Khoa", "Linh"];

// Deterministic pseudo-random numbers (mulberry32), so every machine gets the same demo data.
let seed = 42;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(list: T[], n: number) => [...list].sort(() => rand() - 0.5).slice(0, n);

/** Net results (whole units) that sum to 0: everyone buys in `buyIn`, the pot is split among a few winners. */
function results(players: string[], buyIn: number) {
  const winners = Math.max(1, Math.round(players.length / 3));
  const shares = Array.from({ length: winners }, () => 1 + rand());
  const total = shares.reduce((a, b) => a + b, 0);
  const pot = players.length * buyIn;
  const payouts = shares.map((s) => Math.round((pot * s) / total / 10) * 10);
  payouts[0] += pot - payouts.reduce((a, b) => a + b, 0); // rounding leftovers go to the winner
  return players.map((p, i) => ({ username: p, net: (i < winners ? payouts[i] : 0) - buyIn }));
}

const day = (daysAgo: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d;
};

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const games = await prisma.gameSession.count();
    if (games > 0) throw new Error(`Database already has ${games} games; seed-demo only fills an empty database.`);
    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!admin) throw new Error("No admin account found; run `npm run db:seed` first.");

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    const ids = new Map<string, string>();
    for (const [i, name] of PLAYERS.entries()) {
      const username = `demo${i + 1}`;
      const user = await prisma.user.upsert({
        where: { username },
        update: {},
        create: { username, displayName: name, passwordHash },
      });
      ids.set(name, user.id);
    }

    // 20 tournaments (two per play day) and 10 cash games over the last ~10 weeks.
    const base = Date.now();
    let n = 0;
    const log = async (type: "CUP" | "CASH", daysAgo: number, cupOfDay: number) => {
      const players = pick(PLAYERS, 4 + Math.floor(rand() * 4));
      const rows = results(players, type === "CUP" ? 100 : 200 + Math.floor(rand() * 3) * 100);
      rows.sort((a, b) => b.net - a.net);
      const date = day(daysAgo);
      await prisma.gameSession.create({
        data: {
          type,
          playedAt: date,
          notes: `${type === "CUP" ? "Tour" : "Cash"} ${date.toISOString().slice(0, 10).replaceAll("-", "/")} ${cupOfDay}`,
          championId: type === "CUP" ? ids.get(rows[0].username)! : null,
          createdById: admin.id,
          createdAt: new Date(base + n++ * 1000),
          results: {
            create: rows.map((r) => ({
              userId: ids.get(r.username)!,
              buyIn: r.net < 0 ? -r.net * 100 : 0,
              cashOut: r.net > 0 ? r.net * 100 : 0,
            })),
          },
        },
      });
    };
    for (let week = 10; week >= 1; week--) {
      await log("CASH", week * 7 + 1, 1);
      await log("CUP", week * 7, 1);
      await log("CUP", week * 7, 2);
    }

    // A couple of fund moves: one player pays in, another takes money out.
    for (const [name, kind, amount] of [["Bình", "DEPOSIT", 300], ["An", "WITHDRAW", 300]] as const) {
      await prisma.transaction.create({
        data: { userId: ids.get(name)!, kind, amount: amount * 100, happenedAt: day(3), note: "Demo", createdById: admin.id },
      });
    }

    console.log(`Demo data ready: ${PLAYERS.length} players (demo1..demo${PLAYERS.length}, password "${PASSWORD}"),`);
    console.log("20 tournaments, 10 cash games, 2 fund transactions.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
