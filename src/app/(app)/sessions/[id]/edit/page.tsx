import { notFound, redirect } from "next/navigation";
import { updateGameSession } from "@/app/actions/sessions";
import { requireUser } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { SessionForm } from "../../session-form";

const toInput = (cents: number) => String(cents / 100);

export default async function EditSessionPage({ params }: PageProps<"/sessions/[id]/edit">) {
  const { id } = await params;
  const me = await requireUser();
  const [session, players] = await Promise.all([
    prisma.gameSession.findUnique({ where: { id }, include: { results: true } }),
    prisma.user.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
  ]);
  if (!session) notFound();
  if (me.role !== "ADMIN" && session.createdById !== me.id) redirect(`/sessions/${id}`);

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Edit session</h1>
      <SessionForm
        players={players}
        action={updateGameSession.bind(null, id)}
        submitLabel="Save changes"
        initial={{
          playedAt: session.playedAt.toISOString().slice(0, 10),
          location: session.location ?? "",
          notes: session.notes ?? "",
          results: session.results.map((r) => ({
            playerId: r.userId,
            buyIn: toInput(r.buyIn),
            cashOut: toInput(r.cashOut),
          })),
        }}
      />
    </div>
  );
}
