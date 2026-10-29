import { Card } from "@/components/ui";
import { requireUser } from "@/lib/dal";
import { POKER_TIPS } from "@/lib/poker-tips";

const RED_SUITS = new Set(["♥", "♦"]);

export default async function TipsPage() {
  await requireUser();
  const total = POKER_TIPS.reduce((n, c) => n + c.terms.length, 0);

  return (
    <div lang="vi" className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Poker tips</h1>
        <p className="text-sm text-neutral-500">
          {total} thuật ngữ poker, giữ nguyên tiếng Anh · Nguồn: Poker Coach Việt Nam
        </p>
      </div>

      <nav className="flex flex-wrap gap-2 text-sm">
        {POKER_TIPS.map((c) => (
          <a
            key={c.id}
            href={`#${c.id}`}
            className="rounded-full border border-neutral-200 px-3 py-1 hover:border-emerald-600 dark:border-neutral-800"
          >
            {c.title}
          </a>
        ))}
      </nav>

      {POKER_TIPS.map((c, i) => (
        <section key={c.id} id={c.id} className="scroll-mt-6">
          <div className="mb-3 flex items-baseline gap-2">
            <span className={RED_SUITS.has(c.suit) ? "text-red-600" : ""}>
              {i + 1} {c.suit}
            </span>
            <h2 className="text-lg font-semibold">{c.title}</h2>
            <span className="text-sm text-neutral-500">
              {c.name} · {c.terms.length}
            </span>
          </div>
          <Card className="p-0">
            <dl className="divide-y divide-neutral-100 dark:divide-neutral-800">
              {c.terms.map((t) => (
                <div key={t.term} className="grid gap-1 px-4 py-3 text-sm sm:grid-cols-[14rem_1fr] sm:gap-4">
                  <dt className="font-semibold">{t.term}</dt>
                  <dd className="text-neutral-600 dark:text-neutral-300">{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </section>
      ))}
    </div>
  );
}
