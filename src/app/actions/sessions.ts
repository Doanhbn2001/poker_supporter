"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { formatMoney, toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type SessionFormState = { error?: string } | undefined;

type ParsedSession = {
  playedAt: Date;
  /** Cup name; empty means "name it Cup N for that day" (see withCupName). */
  notes: string;
  championId: string | null;
  results: { userId: string; buyIn: number; cashOut: number }[];
};

async function parseSessionForm(formData: FormData): Promise<ParsedSession | { error: string }> {
  const playedAt = String(formData.get("playedAt") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedAt)) return { error: "Pick a date." };
  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 40) return { error: "Keep the cup name under 40 characters." };

  // Each row has playerId, buyIn and cashOut; rows without a player are ignored.
  const playerIds = formData.getAll("playerId").map(String);
  const buyIns = formData.getAll("buyIn").map(String);
  const cashOuts = formData.getAll("cashOut").map(String);

  const results: ParsedSession["results"] = [];
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
  const diff = results.reduce((t, r) => t + r.cashOut - r.buyIn, 0);
  if (diff !== 0) {
    return { error: `Cash-outs and buy-ins must balance (off by ${formatMoney(diff, { signed: true })}).` };
  }
  if (new Set(results.map((r) => r.userId)).size !== results.length) {
    return { error: "Each player can only appear once." };
  }

  const players = await prisma.user.count({
    where: { id: { in: results.map((r) => r.userId) } },
  });
  if (players !== results.length) return { error: "Unknown player selected." };

  const championId = String(formData.get("championId") ?? "") || null;
  if (championId && !results.some((r) => r.userId === championId)) {
    return { error: "The champion must be one of the players in this session." };
  }

  // Location isn't in the form; leaving it out keeps any existing value on edit.
  return { playedAt: new Date(`${playedAt}T00:00:00Z`), notes, championId, results };
}

/** Fills an empty cup name with "Cup N", N counting that day's other sessions. */
async function withCupName<T extends { playedAt: Date; notes: string }>(fields: T, excludeId?: string) {
  if (fields.notes) return fields;
  const sameDay = await prisma.gameSession.count({
    where: { playedAt: fields.playedAt, ...(excludeId && { id: { not: excludeId } }) },
  });
  return { ...fields, notes: `Cup ${sameDay + 1}` };
}

/** Only an admin may change a session; non-admins are redirected by requireAdmin. */
async function requireSessionEditor(sessionId: string) {
  const me = await requireAdmin();
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { id: true } });
  if (!session) return { error: "Session not found." } as const;
  return { me } as const;
}

export async function createGameSession(
  _state: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const me = await requireAdmin();

  const parsed = await parseSessionForm(formData);
  if ("error" in parsed) return parsed;

  const { results, ...fields } = parsed;
  const session = await prisma.gameSession.create({
    data: { ...(await withCupName(fields)), createdById: me.id, results: { create: results } },
  });

  revalidatePath("/", "layout");
  redirect(`/sessions/${session.id}`);
}

export async function updateGameSession(
  sessionId: string,
  _state: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const auth = await requireSessionEditor(sessionId);
  if ("error" in auth) return { error: auth.error };

  const parsed = await parseSessionForm(formData);
  if ("error" in parsed) return parsed;

  const { results, ...rest } = parsed;
  const fields = await withCupName(rest, sessionId);
  await prisma.$transaction([
    prisma.result.deleteMany({ where: { sessionId } }),
    prisma.gameSession.update({
      where: { id: sessionId },
      data: { ...fields, results: { create: results } },
    }),
  ]);

  revalidatePath("/", "layout");
  redirect(`/sessions/${sessionId}`);
}

export async function deleteGameSession(sessionId: string) {
  const auth = await requireSessionEditor(sessionId);
  if ("error" in auth) throw new Error(auth.error);

  await prisma.gameSession.delete({ where: { id: sessionId } });
  revalidatePath("/", "layout");
  redirect("/sessions");
}
