"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { toCents } from "@/lib/money";
import { prisma } from "@/lib/prisma";

export type SessionFormState = { error?: string } | undefined;

type ParsedSession = {
  playedAt: Date;
  location: string | null;
  notes: string | null;
  results: { userId: string; buyIn: number; cashOut: number }[];
};

async function parseSessionForm(formData: FormData): Promise<ParsedSession | { error: string }> {
  const playedAt = String(formData.get("playedAt") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(playedAt)) return { error: "Pick a date." };

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
  if (new Set(results.map((r) => r.userId)).size !== results.length) {
    return { error: "Each player can only appear once." };
  }

  const players = await prisma.user.count({
    where: { id: { in: results.map((r) => r.userId) } },
  });
  if (players !== results.length) return { error: "Unknown player selected." };

  return {
    playedAt: new Date(`${playedAt}T00:00:00Z`),
    location: String(formData.get("location") ?? "").trim() || null,
    notes: String(formData.get("notes") ?? "").trim() || null,
    results,
  };
}

/** Only the admin or whoever logged the session may change it. */
async function requireSessionEditor(sessionId: string) {
  const me = await requireUser();
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
    select: { createdById: true },
  });
  if (!session) return { error: "Session not found." } as const;
  if (me.role !== "ADMIN" && session.createdById !== me.id) {
    return { error: "Only an admin or the person who logged it can change this session." } as const;
  }
  return { me } as const;
}

export async function createGameSession(
  _state: SessionFormState,
  formData: FormData,
): Promise<SessionFormState> {
  const me = await requireUser();

  const parsed = await parseSessionForm(formData);
  if ("error" in parsed) return parsed;

  const { results, ...fields } = parsed;
  const session = await prisma.gameSession.create({
    data: { ...fields, createdById: me.id, results: { create: results } },
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

  const { results, ...fields } = parsed;
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
