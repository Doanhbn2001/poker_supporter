import "dotenv/config";
import { readFileSync } from "node:fs";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// One-off import of the group's spreadsheet history (prisma/data/history.json).
// Dry run by default; pass --apply to write. Refuses to run if any session or transaction already exists.
//   npx tsx prisma/import-history.ts [--apply]

type History = {
  /**
   * Amounts in whole units. openingBalance is cash profit from before tracking started.
   * wallet is the spreadsheet's running total (what the player can still withdraw); the import
   * refuses to run unless opening + results + deposits - withdrawals equals it for every player.
   */
  players: { username: string; displayName: string; crowns: number; openingBalance: number; wallet: number }[];
  /** Results are net amounts in whole units, keyed by username. `champion` is a username (cups only). */
  sessions: { type: "CUP" | "CASH"; date: string; notes: string; champion?: string; results: Record<string, number> }[];
  /** Money paid into (DEPOSIT) or taken out of (WITHDRAW) the group's fund. */
  transactions: { date: string; username: string; kind: "DEPOSIT" | "WITHDRAW"; amount: number; note?: string }[];
};

const DATA_FILE = "prisma/data/history.json";
/** Players created by the import start with this password (from the env); they change it on /account. */
const DEFAULT_PASSWORD = process.env.IMPORT_DEFAULT_PASSWORD ?? "";
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
    if (s.type !== "CUP" && s.type !== "CASH") throw new Error(`${s.date} ${s.notes}: unknown type "${s.type}"`);
    if (s.champion && (s.type !== "CUP" || !(s.champion in s.results))) {
      throw new Error(`${s.date} ${s.notes}: champion "${s.champion}" must be a player in a cup`);
    }
  }
  for (const t of history.transactions) {
    if (!usernames.has(t.username)) throw new Error(`Transaction ${t.date}: unknown player "${t.username}"`);
    if (!(t.amount > 0) || !Number.isInteger(t.amount)) throw new Error(`Transaction ${t.date}: bad amount ${t.amount}`);
  }

  // The wallet each player can withdraw must come out exactly as in the spreadsheet.
  const moved = (u: string) =>
    history.transactions
      .filter((t) => t.username === u)
      .reduce((a, t) => a + (t.kind === "DEPOSIT" ? t.amount : -t.amount), 0);
  const profit = (u: string, type?: "CUP" | "CASH") =>
    history.sessions.filter((s) => !type || s.type === type).reduce((t, s) => t + (s.results[u] ?? 0), 0);
  for (const p of history.players) {
    const wallet = p.openingBalance + profit(p.username) + moved(p.username);
    if (wallet !== p.wallet) throw new Error(`@${p.username}: wallet ${wallet}, spreadsheet says ${p.wallet}`);
  }
  const fund = history.transactions.reduce((a, t) => a + (t.kind === "DEPOSIT" ? t.amount : -t.amount), 0);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const host = new URL(process.env.DATABASE_URL ?? "").host;
    console.log(`Database: ${host}`);

    const existingSessions = await prisma.gameSession.count();
    if (existingSessions > 0) throw new Error(`Database already has ${existingSessions} sessions; aborting.`);
    const existingTransactions = await prisma.transaction.count();
    if (existingTransactions > 0) throw new Error(`Database already has ${existingTransactions} transactions; aborting.`);

    const admin = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { createdAt: "asc" } });
    if (!admin) throw new Error("No admin account found; run `npm run db:seed` first.");

    const existingUsers = new Set(
      (await prisma.user.findMany({ where: { username: { in: [...usernames] } }, select: { username: true } })).map(
        (u) => u.username,
      ),
    );

    console.log(`Players: ${history.players.length} (${history.players.length - existingUsers.size} new)`);
    const pad = (n: number) => String(n).padStart(6);
    for (const p of history.players) {
      const u = p.username;
      const played = (type: string) => history.sessions.filter((s) => s.type === type && u in s.results).length;
      const tag = existingUsers.has(u) ? "exists" : "new";
      console.log(
        `  ${p.displayName.padEnd(8)} @${u.padEnd(7)} cups=${String(played("CUP")).padStart(2)} tour=${pad(profit(u, "CUP"))} ` +
          `cash=${String(played("CASH")).padStart(2)} cashProfit=${pad(p.openingBalance + profit(u, "CASH"))} ` +
          `fund=${pad(moved(u))} wallet=${pad(p.wallet)} ✓ (${tag})`,
      );
    }
    const count = (type: string) => history.sessions.filter((s) => s.type === type).length;
    console.log(`Sessions: ${count("CUP")} cups + ${count("CASH")} cash games, logged by @${admin.username}`);
    console.log(`Transactions: ${history.transactions.length}, fund holds ${fund}`);

    if (!apply) {
      console.log("\nDry run, nothing written. Re-run with --apply to import.");
      return;
    }
    if (existingUsers.size < usernames.size && DEFAULT_PASSWORD.length < 8) {
      throw new Error("New players need a starting password: set IMPORT_DEFAULT_PASSWORD (8+ characters).");
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

        // createdAt keeps same-day games in spreadsheet order (Cup 1 before Cup 2).
        const base = Date.now();
        for (const [i, s] of history.sessions.entries()) {
          await tx.gameSession.create({
            data: {
              type: s.type,
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

        for (const [i, t] of history.transactions.entries()) {
          await tx.transaction.create({
            data: {
              userId: ids.get(t.username)!,
              kind: t.kind,
              amount: t.amount * 100,
              happenedAt: new Date(`${t.date}T00:00:00Z`),
              note: t.note ?? null,
              createdById: admin.id,
              createdAt: new Date(base + i * 1000),
            },
          });
        }
      },
      { timeout: 60_000 },
    );

    console.log(`\nImported ${history.sessions.length} sessions and ${history.transactions.length} transactions.`);
    if (created > 0) console.log(`Created ${created} players with the default password.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
