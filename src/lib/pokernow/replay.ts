// Step-by-step table state for replaying a parsed Poker Now hand. Pure, so the client replayer and the check
// script share it.
import type { HandEvent, ParsedHand, Street } from "./parse";

/** Table state after one step. Player keys are Poker Now ids. */
export type Frame = {
  /** Index in hand.events of the last event applied. */
  event: number;
  street: Street;
  /** Who acted in this step (null for the opening frame and board cards). */
  actor: string | null;
  stacks: Record<string, number>;
  /** Chips in front of each player on the current street. */
  bets: Record<string, number>;
  /** Chips already in the middle (antes and earlier streets). */
  pot: number;
  board: string[];
  folded: string[];
  allIn: string[];
  shown: Record<string, string[]>;
  won: Record<string, number>;
};

const isPost = (e: HandEvent) => e.kind === "ante" || e.kind === "sb" || e.kind === "bb" || e.kind === "straddle";

/**
 * Frame 0 is the table with antes and blinds posted; then one frame per remaining event. The last frame of a
 * well-formed hand has an empty pot and no bets.
 */
export function buildFrames(hand: ParsedHand): Frame[] {
  let state: Frame = {
    event: -1,
    street: "preflop",
    actor: null,
    stacks: Object.fromEntries(hand.seats.map((s) => [s.player, s.stack])),
    bets: {},
    pot: 0,
    board: [],
    folded: [],
    allIn: [],
    shown: {},
    won: {},
  };

  const sweep = (s: Frame) => {
    s.pot += Object.values(s.bets).reduce((a, b) => a + b, 0);
    s.bets = {};
  };

  const apply = (prev: Frame, e: HandEvent, i: number): Frame => {
    const s: Frame = {
      ...prev,
      event: i,
      actor: "player" in e ? e.player : null,
      stacks: { ...prev.stacks },
      bets: { ...prev.bets },
      shown: { ...prev.shown },
      won: { ...prev.won },
    };
    switch (e.kind) {
      case "ante":
        s.stacks[e.player] -= e.amount;
        s.pot += e.amount;
        break;
      case "sb":
      case "bb":
      case "straddle":
      case "call":
      case "bet":
      case "raise":
        s.stacks[e.player] -= e.amount - (s.bets[e.player] ?? 0);
        s.bets[e.player] = e.amount;
        if (e.allIn) s.allIn = [...s.allIn, e.player];
        break;
      case "fold":
        s.folded = [...s.folded, e.player];
        break;
      case "check":
        break;
      case "board":
        sweep(s);
        s.street = e.street;
        s.board = [...s.board, ...e.cards];
        break;
      case "uncalled": {
        // Usually still in front of the player; take it from the middle if the street was already swept.
        const fromBet = Math.min(s.bets[e.player] ?? 0, e.amount);
        s.bets[e.player] = (s.bets[e.player] ?? 0) - fromBet;
        s.pot -= e.amount - fromBet;
        s.stacks[e.player] += e.amount;
        break;
      }
      case "collect":
        sweep(s);
        s.pot -= e.amount;
        s.stacks[e.player] += e.amount;
        s.won[e.player] = (s.won[e.player] ?? 0) + e.amount;
        break;
      case "show":
        s.shown[e.player] = [...new Set([...(s.shown[e.player] ?? []), ...e.cards])];
        break;
    }
    return s;
  };

  let i = 0;
  for (; i < hand.events.length && isPost(hand.events[i]); i++) state = apply(state, hand.events[i], i);
  state = { ...state, actor: null };
  const frames = [state];
  for (; i < hand.events.length; i++) {
    state = apply(state, hand.events[i], i);
    frames.push(state);
  }
  return frames;
}

export const formatChips = (n: number) => n.toLocaleString("en-US");

/** One event as a sentence, e.g. "An raises to 9,000 (all in)". */
export function describeEvent(e: HandEvent, name: (id: string) => string): string {
  const allIn = "allIn" in e && e.allIn ? " (all in)" : "";
  switch (e.kind) {
    case "ante":
      return `${name(e.player)} posts ante ${formatChips(e.amount)}`;
    case "sb":
      return `${name(e.player)} posts small blind ${formatChips(e.amount)}${allIn}`;
    case "bb":
      return `${name(e.player)} posts big blind ${formatChips(e.amount)}${allIn}`;
    case "straddle":
      return `${name(e.player)} straddles ${formatChips(e.amount)}${allIn}`;
    case "call":
      return `${name(e.player)} calls ${formatChips(e.amount)}${allIn}`;
    case "bet":
      return `${name(e.player)} bets ${formatChips(e.amount)}${allIn}`;
    case "raise":
      return `${name(e.player)} raises to ${formatChips(e.amount)}${allIn}`;
    case "fold":
      return `${name(e.player)} folds`;
    case "check":
      return `${name(e.player)} checks`;
    case "board":
      return `${e.street[0].toUpperCase()}${e.street.slice(1)}: ${e.cards.join(" ")}`;
    case "uncalled":
      return `${formatChips(e.amount)} uncalled, returned to ${name(e.player)}`;
    case "collect":
      return `${name(e.player)} wins ${formatChips(e.amount)}${e.handName ? ` with ${e.handName}` : ""}`;
    case "show":
      return `${name(e.player)} shows ${e.cards.join(" ")}${e.afterHand ? " (after the hand)" : ""}`;
  }
}
