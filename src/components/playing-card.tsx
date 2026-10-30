const RED_SUITS = new Set(["♥", "♦"]);

/** One card written as rank + suit, e.g. "A♠", "10♥". "?" draws a face-down card. */
export function PlayingCard({ card, dim = false }: { card: string; dim?: boolean }) {
  const base = "inline-flex h-12 w-9 shrink-0 flex-col items-center justify-center rounded-md border text-sm font-semibold leading-none shadow-sm";
  if (card === "?") {
    return (
      <span
        aria-label="Lá úp"
        className={`${base} border-emerald-800 bg-emerald-700 bg-[repeating-linear-gradient(45deg,transparent_0_4px,rgba(255,255,255,.15)_4px_8px)]`}
      />
    );
  }
  const suit = card.slice(-1);
  const rank = card.slice(0, -1);
  return (
    // Cards stay white in both themes, like real ones.
    <span
      aria-label={card}
      className={`${base} border-neutral-300 bg-white ${RED_SUITS.has(suit) ? "text-red-600" : "text-neutral-900"} ${
        dim ? "opacity-35" : ""
      }`}
    >
      <span>{rank}</span>
      <span className="mt-0.5">{suit}</span>
    </span>
  );
}

/** A row of cards; cards listed in `dim` are shown faded (not part of the best five). */
export function CardRow({ cards, dim = [] }: { cards: string[]; dim?: string[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {cards.map((c, i) => (
        <PlayingCard key={`${c}-${i}`} card={c} dim={dim.includes(c)} />
      ))}
    </span>
  );
}
