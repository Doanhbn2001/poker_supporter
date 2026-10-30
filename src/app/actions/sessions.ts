"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/dal";
import { parseDay } from "@/lib/dates";
import { defaultGameName, GAME, type GameKind } from "@/lib/games";
import { formatMoney, toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type SessionFormState = { error?: string } | undefined;

type ParsedSession = {
  playedAt: Date;
  /** Game name; empty means "name it Cup/Cash YYYY/MM/DD N" (see withGameName). */
  notes: string;
  championId: string | null;
  results: { userId: string; buyIn: number; cashOut: number }[];
};

async function parseSessionForm(formData: FormData, type: GameKind): Promise<ParsedSession | { error: string }> {
  const day = parseDay(String(formData.get("playedAt") ?? ""));
  if (!day) return { error: "Pick a date." };
  const notes = String(formData.get("notes") ?? "").trim();
  if (notes.length > 40) return { error: "Keep the name under 40 characters." };

  // Each row has playerId, buyIn and cashOut; rows without a player are ignored.
  const playerIds = formData.getAll("playerId").map(String);
  const buyIns = formData.getAll("buyIn").map(String);
  const cashOuts = formData.getAll("cashOut").map(String);

  const results: ParsedSession["results"] = [];
  for (let i = 0; i < playerIds.length; i++) {
    if (!playerIds[i]) continue;
    // A blank field means 0, as the form's running total assumes (winners usually leave buy-in empty).
    const buyIn = toCents(buyIns[i]?.trim() || "0");
    const cashOut = toCents(cashOuts[i]?.trim() || "0");
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

  // Only cups have a champion; a cash game ignores whatever was sent.
  const championId = type === "CUP" ? String(formData.get("championId") ?? "") || null : null;
  if (championId && !results.some((r) => r.userId === championId)) {
    return { error: "The champion must be one of the players in this cup." };
  }

  // Location isn't in the form; leaving it out keeps any existing value on edit.
  return { playedAt: day, notes, championId, results };
}

/** Fills an empty name with "Cup/Cash YYYY/MM/DD N", N counting that day's other games of the same kind. */
async function withGameName<T extends { playedAt: Date; notes: string }>(fields: T, type: GameKind, excludeId?: string) {
  if (fields.notes) return fields;
  const sameDay = await prisma.gameSession.count({
    where: { type, playedAt: fields.playedAt, ...(excludeId && { id: { not: excludeId } }) },
  });
  return { ...fields, notes: defaultGameName(type, fields.playedAt.toISOString().slice(0, 10), sameDay + 1) };
}

/** Only an admin may change a game; non-admins are redirected by requireAdmin. */
async function requireSessionEditor(sessionId: string) {
  const me = await requireAdmin();
  const session = await prisma.gameSession.findUnique({ where: { id: sessionId }, select: { type: true } });
  if (!session) return { error: "Game not found." } as const;
  return { me, type: session.type } as const;
}

/** `type` is bound by the page (cups or cash), so the form can't switch it. */
export async function createGameSession(
  type: GameKind,
  _state: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const me = await requireAdmin();
  if (!(type in GAME)) return { error: "Unknown game type." };

  const parsed = await parseSessionForm(formData, type);
  if ("error" in parsed) return parsed;

  const { results, ...fields } = parsed;
  const session = await prisma.gameSession.create({
    data: { ...(await withGameName(fields, type)), type, createdById: me.id, results: { create: results } },
  });

  revalidatePath("/", "layout");
  redirect(`${GAME[type].base}/${session.id}`);
}

export async function updateGameSession(
  sessionId: string,
  _state: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const auth = await requireSessionEditor(sessionId);
  if ("error" in auth) return { error: auth.error };

  // A game keeps its kind; turning a cup into a cash game would silently drop its champion.
  const parsed = await parseSessionForm(formData, auth.type);
  if ("error" in parsed) return parsed;

  const { results, ...rest } = parsed;
  const fields = await withGameName(rest, auth.type, sessionId);
  await prisma.$transaction([
    prisma.result.deleteMany({ where: { sessionId } }),
    prisma.gameSession.update({
      where: { id: sessionId },
      data: { ...fields, results: { create: results } },
    }),
  ]);

  revalidatePath("/", "layout");
  redirect(`${GAME[auth.type].base}/${sessionId}`);
}

export async function deleteGameSession(sessionId: string) {
  const auth = await requireSessionEditor(sessionId);
  if ("error" in auth) throw new Error(auth.error);

  await prisma.gameSession.delete({ where: { id: sessionId } });
  revalidatePath("/", "layout");
  redirect(GAME[auth.type].base);
}
