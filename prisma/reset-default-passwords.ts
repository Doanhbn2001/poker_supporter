import { config } from "dotenv";
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Gives every account that still uses a known (leaked) password its own random password, and prints the list
// so each player can be told privately. Accounts whose password was already changed are left alone.
//   OLD_PASSWORD='...' npm run db:reset-passwords                    # local DB, dry run
//   OLD_PASSWORD='...' npm run db:reset-passwords -- --prod --apply  # production (PROD_DATABASE_URL in .env.prod)

const prod = process.argv.includes("--prod");
const apply = process.argv.includes("--apply");
config({ path: prod ? ".env.prod" : ".env", quiet: true });
const url = prod ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
const oldPassword = process.env.OLD_PASSWORD ?? "";

// No 0/O/1/l/I, so passwords read out over chat aren't mistyped.
const ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newPassword = () => Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

async function main() {
  if (!url) throw new Error(prod ? "Put PROD_DATABASE_URL in .env.prod." : "DATABASE_URL is not set.");
  if (!oldPassword) throw new Error("Set OLD_PASSWORD to the password to replace.");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  try {
    console.log(`Database: ${new URL(url).host}${prod ? " (production)" : ""}`);
    const users = await prisma.user.findMany({
      select: { id: true, username: true, displayName: true, passwordHash: true },
      orderBy: { username: "asc" },
    });
    const affected = users.filter((u) => bcrypt.compareSync(oldPassword, u.passwordHash));
    console.log(`${affected.length} of ${users.length} accounts still use that password.`);
    if (affected.length === 0) return;

    if (!apply) {
      for (const u of affected) console.log(`  ${u.username} (${u.displayName})`);
      console.log("\nDry run, nothing changed. Re-run with --apply to set new passwords.");
      return;
    }

    const rows = affected.map((u) => ({ ...u, password: newPassword() }));
    await prisma.$transaction(
      rows.map((r) => prisma.user.update({ where: { id: r.id }, data: { passwordHash: bcrypt.hashSync(r.password, 10) } })),
    );
    console.log("\nNew passwords (send each one privately; players can change it on /account):\n");
    for (const r of rows) console.log(`  ${r.displayName.padEnd(10)} username: ${r.username.padEnd(8)} password: ${r.password}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
