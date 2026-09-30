import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

// Creates the first admin account from ADMIN_* env vars. Safe to re-run.
async function main() {
  const username = process.env.ADMIN_USERNAME?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) throw new Error("Set ADMIN_USERNAME and ADMIN_PASSWORD in .env");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`Admin "${username}" already exists, skipping.`);
  } else {
    await prisma.user.create({
      data: {
        username,
        displayName: process.env.ADMIN_DISPLAY_NAME || username,
        passwordHash: await bcrypt.hash(password, 10),
        role: "ADMIN",
      },
    });
    console.log(`Created admin "${username}".`);
  }
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
