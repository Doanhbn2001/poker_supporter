import { Card } from "@/components/ui";
import { requireAdmin } from "@/lib/dal";
import { prisma } from "@/lib/prisma";
import { AddPlayerForm } from "./add-player-form";

export default async function PlayersPage() {
  await requireAdmin();
  const players = await prisma.user.findMany({
    select: { id: true, username: true, displayName: true, role: true },
    orderBy: { displayName: "asc" },
  });

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <section>
        <h1 className="mb-3 text-xl font-semibold">Players</h1>
        <Card className="divide-y divide-neutral-100 p-0 dark:divide-neutral-800">
          {players.map((p) => (
            <div key={p.id} className="flex justify-between px-4 py-2 text-sm">
              <span className="font-medium">{p.displayName}</span>
              <span className="text-neutral-500">
                @{p.username}
                {p.role === "ADMIN" && " · admin"}
              </span>
            </div>
          ))}
        </Card>
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">Add a player</h2>
        <Card>
          <AddPlayerForm />
        </Card>
      </section>
    </div>
  );
}
