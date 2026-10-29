import Link from "next/link";
import { SessionCard } from "@/components/session-card";
import { Card } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { getSessions } from "@/lib/stats";

export default async function SessionsPage() {
  const me = await requireUser();
  const sessions = await getSessions();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Sessions</h1>
        {me.role === "ADMIN" && (
          <Link href="/sessions/new" className="text-sm font-medium text-emerald-600 hover:underline">
            + Log session
          </Link>
        )}
      </div>
      {sessions.length === 0 ? (
        <Card className="text-center text-neutral-500">No sessions logged yet.</Card>
      ) : (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      )}
    </div>
  );
}
