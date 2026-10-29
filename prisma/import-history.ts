import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// One-off import of the group's spreadsheet history (prisma/data/history.json).
// Dry run by default; pass --apply to write. Refuses to run if any session already exists.
//   npx tsx prisma/import-history.ts [--apply]

type History = {
  /** openingBalance is the carried-over total from before 26/09, in whole units. */
  players: { username: string; displayName: string; crowns: number; openingBalance: number }[];
  /** Results are net amounts in whole units, keyed by username. `champion` is a username, when recorded. */
  sessions: { date: string; notes: string; champion?: string; results: Record<string, number> }[];
};

const DATA_FILE = "prisma/data/history.json";
/** Every imported player starts with this password; they can change it on the Account page. */
const DEFAULT_PASSWORD = "12345678";
const apply = process.argv.includes("--apply");

async function main() {
  const history: History = JSON.parse(readFileSync(DATA_FILE, "utf8"));
  const usernames = new Set(history.players.map((p) => p.username));

  const openingSum = history.players.reduce((t, p) => t + p.openingBalance, 0);
  if (openingSum !== 0) throw new Error(`Opening balances sum to ${openingSum}, expected 0`);

  for (const s of history.sessions) {
    const sum = Object.values(s.results).reduce((a, b) => a + b, 0);
    if (sum !== 0) throw new Error(`${s.date} ${s.notes}: results sum to ${sum}, expected 0`);
    for (const u of Object.keys(s.results)) {
      if (!usernames.has(u)) throw new Error(`${s.date} ${s.notes}: unknown player "${u}"`);
    }
    if (s.champion && !(s.champion in s.results)) {
      throw new Error(`${s.date} ${s.notes}: champion "${s.champion}" did not play`);
    }
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const host = new URL(process.env.DATABASE_URL ?? "").host;
    console.log(`Database: ${host}`);

    const existingSessions = await prisma.gameSession.count();
    if (existingSessions > 0) throw new Error(`Database already has ${existingSessions} sessions; aborting.`);

    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
    if (!admin) throw new Error("No admin account found; run `npm run db:seed` first.");

    const existingUsers = new Set(
      (await prisma.user.findMany({ where: { username: { in: [...usernames] } }, select: { username: true } })).map(
        (u) => u.username,
      ),
    );

    console.log(`Players: ${history.players.length} (${history.players.length - existingUsers.size} new)`);
    for (const p of history.players) {
      const played = history.sessions.filter((s) => p.username in s.results).length;
      const total = history.sessions.reduce((t, s) => t + (s.results[p.username] ?? 0), p.openingBalance);
      const tag = existingUsers.has(p.username) ? "exists" : "new";
      console.log(
        `  ${p.displayName.padEnd(8)} @${p.username.padEnd(7)} opening=${String(p.openingBalance).padStart(6)} ` +
          `sessions=${String(played).padStart(2)} total=${String(total).padStart(6)} crowns=${p.crowns} (${tag})`,
      );
    }
    console.log(`Sessions: ${history.sessions.length}, logged by @${admin.username}`);

    if (!apply) {
      console.log("\nDry run, nothing written. Re-run with --apply to import.");
      return;
    }

    const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
    let created = 0;
    await prisma.$transaction(
      async (tx) => {
        const ids = new Map<string, string>();
        for (const p of history.players) {
          if (existingUsers.has(p.username)) {
            const user = await tx.user.update({
              where: { username: p.username },
              data: { crowns: p.crowns, openingBalance: p.openingBalance * 100 },
            });
            ids.set(p.username, user.id);
            continue;
          }
          const user = await tx.user.create({
            data: {
              username: p.username,
              displayName: p.displayName,
              crowns: p.crowns,
              openingBalance: p.openingBalance * 100,
              passwordHash,
            },
          });
          ids.set(p.username, user.id);
          created++;
        }

        // createdAt keeps same-day cups in spreadsheet order (Cup 1 before Cup 2).
        const base = Date.now();
        for (const [i, s] of history.sessions.entries()) {
          await tx.gameSession.create({
            data: {
              playedAt: new Date(`${s.date}T00:00:00Z`),
              notes: s.notes,
              championId: s.champion ? ids.get(s.champion)! : null,
              createdById: admin.id,
              createdAt: new Date(base + i * 1000),
              results: {
                // Only the net is known: losses become the buy-in, wins the cash-out (amounts in cents).
                create: Object.entries(s.results).map(([u, net]) => ({
                  userId: ids.get(u)!,
                  buyIn: net < 0 ? -net * 100 : 0,
                  cashOut: net > 0 ? net * 100 : 0,
                })),
              },
            },
          });
        }
      },
      { timeout: 60_000 },
    );

    console.log(`\nImported ${history.sessions.length} sessions.`);
    if (created > 0) console.log(`Created ${created} players with the default password.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
