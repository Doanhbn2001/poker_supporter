// Playing-style stats from parsed Poker Now hands. Counters are plain sums so they can be stored per log
// (HandLog.stats) and added up across logs for a player's profile.
import { endStacks, type ParsedHand } from "./parse";

export type PlayStats = {
  hands: number;
  /** Sum of players dealt in over those hands: seats / hands = average table size. */
  seats: number;
  /** Hands where the player put chips in preflop by choice (call or raise; posting a blind doesn't count). */
  vpip: number;
  /** Hands where the player raised preflop. */
  pfr: number;
  /** Times the player faced exactly one preflop raise, and how often they re-raised it. */
  threeBetChances: number;
  threeBets: number;
  /** Postflop bets + raises, and postflop calls (aggression factor = bets / calls). */
  aggressive: number;
  calls: number;
  sawFlop: number;
  /** Saw the flop and reached showdown; and how often they won something there. */
  showdowns: number;
  showdownsWon: number;
  /** Chips won minus lost, in big blinds of each hand (bb/100 = netBB / hands * 100). */
  netBB: number;
};

export const emptyStats = (): PlayStats => ({
  hands: 0,
  seats: 0,
  vpip: 0,
  pfr: 0,
  threeBetChances: 0,
  threeBets: 0,
  aggressive: 0,
  calls: 0,
  sawFlop: 0,
  showdowns: 0,
  showdownsWon: 0,
  netBB: 0,
});

export function addStats(a: PlayStats, b: PlayStats): PlayStats {
  const out = { ...a };
  for (const k of Object.keys(out) as (keyof PlayStats)[]) out[k] += b[k] ?? 0;
  return out;
}

/** The hand's big blind (falls back to twice the small blind, then 1). */
export function bigBlind(h: ParsedHand): number {
  const bb = h.events.find((e) => e.kind === "bb");
  if (bb && "amount" in bb) return bb.amount;
  const sb = h.events.find((e) => e.kind === "sb");
  return sb && "amount" in sb ? sb.amount * 2 : 1;
}

/** Each player's chip result in the hand (end stack minus start stack). */
export function handNet(h: ParsedHand): Record<string, number> {
  const end = endStacks(h);
  return Object.fromEntries(h.seats.map((s) => [s.player, end[s.player] - s.stack]));
}

/** Stats per Poker Now player id. */
export function computeStats(hands: ParsedHand[]): Record<string, PlayStats> {
  const out: Record<string, PlayStats> = {};
  const get = (p: string) => (out[p] ??= emptyStats());

  for (const h of hands) {
    const bb = bigBlind(h);
    const net = handNet(h);
    for (const s of h.seats) {
      const st = get(s.player);
      st.hands++;
      st.seats += h.seats.length;
      st.netBB += net[s.player] / bb;
    }

    const vpip = new Set<string>();
    const pfr = new Set<string>();
    const facedOneRaise = new Set<string>();
    const folded = new Set<string>();
    const sawFlop = new Set<string>();
    let raises = 0;
    let raiser: string | null = null;

    for (const e of h.events) {
      if (e.kind === "board" && e.street === "flop") {
        for (const s of h.seats) if (!folded.has(s.player)) sawFlop.add(s.player);
        continue;
      }
      if (e.kind === "fold") folded.add(e.player);
      if (e.kind !== "call" && e.kind !== "raise" && e.kind !== "bet" && e.kind !== "fold" && e.kind !== "check") continue;

      if (e.street === "preflop") {
        if (raises === 1 && e.player !== raiser && !facedOneRaise.has(e.player)) {
          facedOneRaise.add(e.player);
          get(e.player).threeBetChances++;
          if (e.kind === "raise") get(e.player).threeBets++;
        }
        if (e.kind === "call" || e.kind === "raise" || e.kind === "bet") vpip.add(e.player);
        if (e.kind === "raise") {
          pfr.add(e.player);
          raises++;
          raiser = e.player;
        }
      } else if (e.kind === "bet" || e.kind === "raise") get(e.player).aggressive++;
      else if (e.kind === "call") get(e.player).calls++;
    }

    vpip.forEach((p) => get(p).vpip++);
    pfr.forEach((p) => get(p).pfr++);
    sawFlop.forEach((p) => get(p).sawFlop++);
    if (h.showdown) {
      const winners = new Set(h.events.flatMap((e) => (e.kind === "collect" ? [e.player] : [])));
      for (const p of sawFlop) {
        if (folded.has(p)) continue;
        get(p).showdowns++;
        if (winners.has(p)) get(p).showdownsWon++;
      }
    }
  }
  return out;
}

const pct = (a: number, b: number) => (b > 0 ? (100 * a) / b : null);

/** The usual ratios; null when there's nothing to divide by. */
export function ratios(s: PlayStats) {
  return {
    vpip: pct(s.vpip, s.hands),
    pfr: pct(s.pfr, s.hands),
    threeBet: pct(s.threeBets, s.threeBetChances),
    af: s.calls > 0 ? s.aggressive / s.calls : s.aggressive > 0 ? Infinity : null,
    wtsd: pct(s.showdowns, s.sawFlop),
    wsd: pct(s.showdownsWon, s.showdowns),
    bb100: s.hands > 0 ? (s.netBB / s.hands) * 100 : null,
    tableSize: s.hands > 0 ? s.seats / s.hands : 0,
  };
}

export const MIN_HANDS_FOR_INSIGHTS = 30;

/**
 * Plain-language notes on leaks, in Vietnamese like the Guide and Tips pages. Thresholds loosen for short-handed
 * tables, where playing more hands is correct. Rough rules of thumb, not solver advice.
 */
export function insights(s: PlayStats): string[] {
  if (s.hands < MIN_HANDS_FOR_INSIGHTS) return [];
  const r = ratios(s);
  const size = r.tableSize;
  const [loose, tight] = size <= 4 ? [65, 30] : size <= 6 ? [45, 18] : [35, 14];
  const notes: string[] = [];
  const vpip = r.vpip ?? 0;
  const pfr = r.pfr ?? 0;

  if (vpip > loose) notes.push(`Vào pot ${Math.round(vpip)}% số hand: quá rộng với bàn ~${Math.round(size)} người. Bỏ bớt các tay yếu (lá lẻ, khác chất, không liền).`);
  else if (vpip < tight) notes.push(`Chỉ vào pot ${Math.round(vpip)}% số hand: hơi chặt, đối thủ dễ né khi bạn tham gia. Có thể mở rộng thêm ở vị trí muộn (dealer, cutoff).`);
  if (vpip - pfr >= 25) notes.push(`Vào pot ${Math.round(vpip)}% nhưng chỉ raise ${Math.round(pfr)}%: hay limp/call trước flop. Thói quen tốt hơn là raise hoặc fold, ít khi chỉ call.`);
  if (r.af !== null && s.aggressive + s.calls >= 15) {
    if (r.af < 1) notes.push(`Sau flop call nhiều hơn bet/raise (AF ${r.af.toFixed(1)}): thụ động. Khi có bài mạnh hoặc draw tốt, hãy chủ động bet để ăn thêm và giành pot.`);
    else if (r.af > 4) notes.push(`Rất hung hăng sau flop (AF ${r.af === Infinity ? "∞" : r.af.toFixed(1)}): đối thủ có thể chờ bài mạnh rồi call/bẫy bạn. Chọn lọc lúc bluff hơn.`);
  }
  if (s.sawFlop >= 20 && r.wtsd !== null && r.wsd !== null && s.showdowns >= 8) {
    if (r.wtsd > 40 && r.wsd < 45) notes.push(`Hay theo tới showdown (${Math.round(r.wtsd)}%) nhưng chỉ thắng ${Math.round(r.wsd)}%: đang call xuống với bài yếu. Bỏ bài sớm hơn khi đối thủ bet mạnh ở turn/river.`);
    if (r.wtsd < 20) notes.push(`Ít khi tới showdown (${Math.round(r.wtsd)}% số flop đã xem): có thể đang bỏ bài quá dễ sau flop, đối thủ bluff bạn sẽ có lời.`);
  }
  if (s.threeBetChances >= 15 && (r.threeBet ?? 0) < 4) notes.push(`Gần như không 3-bet (${Math.round(r.threeBet ?? 0)}%): đối thủ raise thoải mái mà không sợ bị re-raise. Hãy 3-bet với bài mạnh (AA–TT, AK, AQ).`);
  return notes;
}
