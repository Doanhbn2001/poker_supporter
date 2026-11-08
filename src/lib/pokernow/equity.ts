// Hold'em hand evaluation and all-in equity, small enough to run in the browser while replaying a hand.

const RANKS: Record<string, number> = { "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, T: 10, J: 11, Q: 12, K: 13, A: 14 };
const SUITS: Record<string, number> = { "♠": 0, "♥": 1, "♦": 2, "♣": 3 };

/** A card as rank * 4 + suit (rank 2–14, suit 0–3). */
export type Card = number;

export function toCard(s: string): Card {
  const rank = RANKS[s.slice(0, -1)];
  const suit = SUITS[s.slice(-1)];
  if (rank === undefined || suit === undefined) throw new Error(`Bad card: ${s}`);
  return rank * 4 + suit;
}

const rankOf = (c: Card) => c >> 2;
const suitOf = (c: Card) => c & 3;

/** Highest card of a straight in a rank bitmask (bit r set = rank r present), or 0. Handles the A-2-3-4-5 wheel. */
function straightHigh(mask: number): number {
  for (let hi = 14; hi >= 6; hi--) if (((mask >> (hi - 4)) & 0b11111) === 0b11111) return hi;
  return (mask & 0b100000000111100) === 0b100000000111100 ? 5 : 0;
}

/** Packs a category (0 high card … 8 straight flush) and up to five tie-break ranks into one comparable number. */
const score = (cat: number, ranks: number[]) => ranks.slice(0, 5).reduce((s, r) => s * 15 + r, cat) * 15 ** (5 - Math.min(5, ranks.length));

/** Strength of the best five-card hand among 5–7 cards; higher wins. */
export function evaluate(cards: Card[]): number {
  const counts = new Array<number>(15).fill(0);
  const suitMasks = [0, 0, 0, 0];
  const suitCounts = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) {
    const r = rankOf(c);
    const s = suitOf(c);
    counts[r]++;
    suitMasks[s] |= 1 << r;
    suitCounts[s]++;
    mask |= 1 << r;
  }

  const flushSuit = suitCounts.findIndex((n) => n >= 5);
  if (flushSuit >= 0) {
    const sf = straightHigh(suitMasks[flushSuit]);
    if (sf) return score(8, [sf]);
  }

  // Ranks grouped by how many of each, biggest groups and ranks first.
  const groups: [number, number][] = [];
  for (let r = 14; r >= 2; r--) if (counts[r]) groups.push([counts[r], r]);
  groups.sort((a, b) => b[0] - a[0] || b[1] - a[1]);
  const kickers = (exclude: number[], n: number) => {
    const out: number[] = [];
    for (let r = 14; r >= 2 && out.length < n; r--) if (counts[r] && !exclude.includes(r)) out.push(r);
    return out;
  };

  const [top, second] = groups;
  if (top[0] === 4) return score(7, [top[1], ...kickers([top[1]], 1)]);
  if (top[0] === 3 && second && second[0] >= 2) return score(6, [top[1], second[1]]);
  if (flushSuit >= 0) {
    const ranks: number[] = [];
    for (let r = 14; r >= 2 && ranks.length < 5; r--) if (suitMasks[flushSuit] & (1 << r)) ranks.push(r);
    return score(5, ranks);
  }
  const st = straightHigh(mask);
  if (st) return score(4, [st]);
  if (top[0] === 3) return score(3, [top[1], ...kickers([top[1]], 2)]);
  if (top[0] === 2 && second && second[0] === 2) return score(2, [top[1], second[1], ...kickers([top[1], second[1]], 1)]);
  if (top[0] === 2) return score(1, [top[1], ...kickers([top[1]], 3)]);
  return score(0, kickers([], 5));
}

/** Deterministic RNG (mulberry32), so the same hand always shows the same equity. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Each player's share of the pot if the board were run out, in [0, 1] (ties split). Exact when at most two board
 * cards are left; otherwise a seeded Monte Carlo estimate (good to about ±1%).
 */
export function equity(holes: string[][], board: string[], samples = 12000): number[] {
  const hc = holes.map((h) => h.map(toCard));
  const bc = board.map(toCard);
  const used = new Set([...hc.flat(), ...bc]);
  const deck: Card[] = [];
  for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) if (!used.has(r * 4 + s)) deck.push(r * 4 + s);
  const need = 5 - bc.length;
  const wins = new Array<number>(hc.length).fill(0);
  let total = 0;

  const settle = (runout: Card[]) => {
    const full = [...bc, ...runout];
    const scores = hc.map((h) => evaluate([...h, ...full]));
    const best = Math.max(...scores);
    const winners = scores.filter((s) => s === best).length;
    scores.forEach((s, i) => {
      if (s === best) wins[i] += 1 / winners;
    });
    total++;
  };

  if (need <= 0) settle([]);
  else if (need === 1) for (const a of deck) settle([a]);
  else if (need === 2) for (let i = 0; i < deck.length; i++) for (let j = i + 1; j < deck.length; j++) settle([deck[i], deck[j]]);
  else {
    const rand = rng([...used].reduce((s, c) => s * 31 + c, 7) | 0);
    const d = [...deck];
    for (let n = 0; n < samples; n++) {
      // Partial Fisher–Yates: the first `need` cards are a fresh random runout.
      for (let i = 0; i < need; i++) {
        const j = i + Math.floor(rand() * (d.length - i));
        [d[i], d[j]] = [d[j], d[i]];
      }
      settle(d.slice(0, need));
    }
  }
  return wins.map((w) => w / total);
}
