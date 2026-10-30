"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/dal";
import { parseDay } from "@/lib/dates";
import { formatMoney, toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getLeaderboards } from "@/lib/stats";

/** `id` is the recorded transaction, so the form can drop its message once that entry is deleted. */
export type FundFormState = { error?: string; success?: string; id?: string } | undefined;

/** Records money a player paid into (DEPOSIT) or took out of (WITHDRAW) the fund. */
export async function createTransaction(_state: FundFormState, formData: FormData): Promise<FundFormState> {
  const me = await requireAdmin();

  const userId = String(formData.get("userId") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const amount = toCents(String(formData.get("amount") ?? ""));
  const day = parseDay(String(formData.get("happenedAt") ?? ""));
  const note = String(formData.get("note") ?? "").trim();

  if (kind !== "DEPOSIT" && kind !== "WITHDRAW") return { error: "Choose deposit or withdrawal." };
  if (!amount) return { error: "Enter an amount above 0." };
  if (!day) return { error: "Pick a date." };
  if (note.length > 100) return { error: "Note: 100 characters max." };
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { displayName: true } });
  if (!user) return { error: "Choose a player." };

  const { id } = await prisma.transaction.create({
    data: { userId, kind, amount, happenedAt: day, note: note || null, createdById: me.id },
  });
  revalidatePath("/", "layout");
  return {
    id,
    success: `${user.displayName} ${kind === "DEPOSIT" ? "deposited" : "withdrew"} ${formatMoney(amount)}.`,
  };
}

export async function deleteTransaction(id: string) {
  await requireAdmin();
  await prisma.transaction.deleteMany({ where: { id } });
  revalidatePath("/", "layout");
}

/**
 * Settles everyone at once: players who owe deposit what they owe, players in credit withdraw it.
 * Afterwards every wallet is 0 and so is the fund. Profit and the leaderboards don't change.
 */
export async function settleAll(_state: FundFormState, formData: FormData): Promise<FundFormState> {
  const me = await requireAdmin();
  const day = parseDay(String(formData.get("happenedAt") ?? ""));
  if (!day) return { error: "Pick a date." };

  const { all } = await getLeaderboards();
  const open = all.filter((p) => p.wallet !== 0);
  if (open.length === 0) return { error: "Everyone is already settled." };

  await prisma.transaction.createMany({
    data: open.map((p) => ({
      userId: p.userId,
      kind: p.wallet < 0 ? ("DEPOSIT" as const) : ("WITHDRAW" as const),
      amount: Math.abs(p.wallet),
      happenedAt: day,
      note: "Settle up",
      createdById: me.id,
    })),
  });
  revalidatePath("/", "layout");
  return { success: `Settled ${open.length} players.` };
}
