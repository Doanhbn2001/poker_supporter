import { createGameSession } from "@/app/actions/sessions";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { getCupsByDate } from "@/lib/stats";
import { SessionForm } from "../session-form";

export default async function NewSessionPage() {
  await requireAdmin();
  // Admin accounts manage the app and don't play, so they aren't offered as players.
  const [players, cupsByDate] = await Promise.all([
    prisma.user.findMany({
      where: { role: "PLAYER" },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    getCupsByDate(),
  ]);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold">Log a session</h1>
      <SessionForm players={players} action={createGameSession} cupsByDate={cupsByDate} />
    </div>
  );
}
