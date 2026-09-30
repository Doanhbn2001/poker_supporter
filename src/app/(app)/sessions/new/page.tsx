import { createGameSession } from "@/app/actions/sessions";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { SessionForm } from "../session-form";

export default async function NewSessionPage() {
  const me = await requireUser();
  const players = await prisma.user.findMany({
    select: { id: true, displayName: true },
    orderBy: { displayName: "asc" },
  });

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Log a session</h1>
      <SessionForm players={players} action={createGameSession} defaultPlayerId={me.id} />
    </div>
  );
}
