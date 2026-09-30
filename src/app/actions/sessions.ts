"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type SessionFormState = { error?: string } | undefined;

export async function createGameSession(
  _state: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const me = await requireUser();

  const playedAt = String(formData.get("playedAt") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedAt)) return { error: "Pick a date." };

  // Each row has playerId, buyIn and cashOut; rows without a player are ignored.
  const playerIds = formData.getAll("playerId").map(String);
  const buyIns = formData.getAll("buyIn").map(String);
  const cashOuts = formData.getAll("cashOut").map(String);

  const results: { userId: string; buyIn: number; cashOut: number }[] = [];
  for (let i = 0; i < playerIds.length; i++) {
    if (!playerIds[i]) continue;
    const buyIn = toCents(buyIns[i] ?? "");
    const cashOut = toCents(cashOuts[i] ?? "");
    if (buyIn === null || cashOut === null) {
      return { error: `Row ${i + 1}: enter buy-in and cash-out as numbers.` };
    }
    results.push({ userId: playerIds[i], buyIn, cashOut });
  }

  if (results.length < 2) return { error: "Add at least two players." };
  if (new Set(results.map((r) => r.userId)).size !== results.length) {
    return { error: "Each player can only appear once." };
  }

  const players = await prisma.user.count({
    where: { id: { in: results.map((r) => r.userId) } },
  });
  if (players !== results.length) return { error: "Unknown player selected." };

  await prisma.gameSession.create({
    data: {
      playedAt: new Date(`${playedAt}T00:00:00Z`),
      location: String(formData.get("location") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      createdById: me.id,
      results: { create: results },
    },
  });

  redirect("/");
}
