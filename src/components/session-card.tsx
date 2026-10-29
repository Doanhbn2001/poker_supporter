import Link from "next/link";
import { Card, Money } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

type Props = {
  session: {
    id: string;
    playedAt: Date;
    location: string | null;
    pot: number;
    players: number;
    winner?: { name: string; net: number };
    champion: string | null;
  };
};

export function SessionCard({ session: s }: Props) {
  return (
    <Link href={`/sessions/${s.id}`} className="block">
      <Card className="flex flex-wrap items-center justify-between gap-2 py-3 hover:border-emerald-600">
        <div>
          <div className="font-medium">
            {formatDate(s.playedAt)}
            {s.location && <span className="text-neutral-500"> · {s.location}</span>}
          </div>
          <div className="text-sm text-neutral-500">
            {s.players} players · {formatMoney(s.pot)} total buy-ins
            {s.champion && <> · 👑 {s.champion}</>}
          </div>
        </div>
        {s.winner && (
          <div className="text-sm">
            Top: <span className="font-medium">{s.winner.name}</span> <Money cents={s.winner.net} />
          </div>
        )}
      </Card>
    </Link>
  );
}
