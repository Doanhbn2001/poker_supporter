// Parser for the CSV hand log that Poker Now exports ("Download log": columns entry, at, order).
// Pure and framework-free: the import form runs it in the browser for a preview, the server action runs it again
// before writing, and scripts/check-pokernow-log.ts runs it from the command line.

export type Street = "preflop" | "flop" | "turn" | "river";

/**
 * One line of a hand, in order. Players are Poker Now ids (the part after " @ " in `"Name @ id"`).
 * Amounts are chips. For sb/bb/straddle/call/bet/raise, `amount` is the player's TOTAL in front of them on this
 * street after the action (Poker Now writes "calls 400" meaning "calls to 400"); antes are dead money and never
 * count toward that total.
 */
export type HandEvent =
  | { kind: "ante"; street: Street; player: string; amount: number }
  | {
      kind: "sb" | "bb" | "straddle" | "call" | "bet" | "raise";
      street: Street;
      player: string;
      amount: number;
      allIn: boolean;
    }
  | { kind: "fold" | "check"; street: Street; player: string }
  | { kind: "board"; street: Exclude<Street, "preflop">; cards: string[] }
  | { kind: "uncalled"; street: Street; player: string; amount: number }
  | {
      kind: "collect";
      street: Street;
      player: string;
      amount: number;
      handName: string | null;
      combo: string[];
    }
  /** `afterHand`: shown once the hand was over (Poker Now lets players flip cards after winning or folding). */
  | { kind: "show"; street: Street; player: string; cards: string[]; afterHand: boolean };

export type Seat = { seat: number; player: string; stack: number };

export type ParsedHand = {
  number: number;
  pokerNowId: string;
  /** e.g. "No Limit Texas Hold'em". */
  game: string;
  /** ISO timestamp of the "starting hand" line. */
  startedAt: string;
  /** Poker Now id of the dealer, null for a dead button. */
  dealer: string | null;
  seats: Seat[];
  /** The log owner's hole cards ("Your hand is …"); private, see HandLog.heroUserId. */
  heroCards: string[];
  events: HandEvent[];
  /** Final board (0–5 cards). */
  board: string[];
  /** Rabbit hunt: the cards that would have come. */
  undealt: string[];
  /** Sum of all "collected" amounts. */
  pot: number;
  /** True if anyone collected with a named hand, i.e. the hand went to showdown. */
  showdown: boolean;
};

export type PokerNowPlayer = { id: string; name: string; hands: number };

export type ParseResult = {
  hands: ParsedHand[];
  /** Everyone dealt into at least one hand, most hands first. */
  players: PokerNowPlayer[];
  /** Poker Now id of the log owner, guessed from showdowns that match "Your hand is …"; null if unsure. */
  heroGuess: string | null;
  /** Lines that couldn't be understood, or chip counts that don't add up; the hands still parse. */
  warnings: string[];
  /** Problems that make the log unsafe to import (pot doesn't balance, not a Poker Now log, …). */
  errors: string[];
};

// ---------------------------------------------------------------------------------------------------------------
// CSV

/** RFC 4180-ish: quoted fields, "" escapes, newlines inside quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0] !== "");
}

// ---------------------------------------------------------------------------------------------------------------
// Lines

const ID = "[A-Za-z0-9_-]+";
/** `"Name @ id"` at the start of a line; the name is greedy so it may itself contain " @ ". */
const ACTOR = new RegExp(`^"(.+) @ (${ID})" (.+)$`);
const PLAYER_IN = new RegExp(`"(.+?) @ (${ID})"`);
const SEAT = new RegExp(`#(\\d+) "(.+?) @ (${ID})" \\((\\d+)\\)`, "g");
const CARD = /(?:10|[2-9TJQKA])[♠♥♦♣]/g;

const cards = (s: string) => s.match(CARD) ?? [];
/** "Turn: 3♥, 6♠, 7♣ [Q♠]" → the new cards are the bracketed ones. */
const bracketCards = (s: string) => cards(/\[([^\]]*)\]/.exec(s)?.[1] ?? "");

type Entry = { text: string; at: string; order: number };

function readEntries(csv: string): Entry[] | string {
  const rows = parseCsv(csv.replace(/^﻿/, ""));
  if (rows.length === 0) return "The file is empty.";
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const [e, a, o] = ["entry", "at", "order"].map((h) => header.indexOf(h));
  if (e < 0 || a < 0 || o < 0) return "Not a Poker Now log: expected the columns entry, at, order.";
  return rows
    .slice(1)
    .map((r) => ({ text: r[e] ?? "", at: r[a] ?? "", order: Number(r[o]) }))
    .filter((x) => x.text !== "")
    .sort((x, y) => x.order - y.order); // the export is newest first
}

// ---------------------------------------------------------------------------------------------------------------
// Hands

type Draft = ParsedHand & { street: Street; ended: boolean };

function startHand(text: string, at: string): Draft | null {
  const m = /^-- starting hand #(\d+) \(id: ([^)]+)\)\s+(.*?)\s+\((dead button|dealer: (.+))\) --$/.exec(text);
  if (!m) return null;
  const dealer = m[5] ? PLAYER_IN.exec(m[5])?.[2] ?? null : null;
  return {
    number: Number(m[1]),
    pokerNowId: m[2],
    game: m[3],
    startedAt: at,
    dealer,
    seats: [],
    heroCards: [],
    events: [],
    board: [],
    undealt: [],
    pot: 0,
    showdown: false,
    street: "preflop",
    ended: false,
  };
}

/** Applies one line to the current hand. Returns false if the line wasn't understood. */
function applyLine(h: Draft, text: string): boolean {
  if (text.startsWith("Player stacks:")) {
    h.seats = [...text.matchAll(SEAT)].map((m) => ({ seat: Number(m[1]), player: m[3], stack: Number(m[4]) }));
    return h.seats.length > 0;
  }
  if (text.startsWith("Your hand is ")) {
    h.heroCards = cards(text);
    return h.heroCards.length > 0;
  }
  if (text === "Dead Small Blind") return true; // informational: nobody posts it
  const board = /^(Flop|Turn|River):/.exec(text);
  if (board) {
    const street = board[1].toLowerCase() as "flop" | "turn" | "river";
    const added = bracketCards(text);
    h.street = street;
    h.board = [...h.board, ...added];
    h.events.push({ kind: "board", street, cards: added });
    return added.length > 0;
  }
  if (text.startsWith("Undealt cards:")) {
    h.undealt = bracketCards(text);
    return true;
  }
  const uncalled = new RegExp(`^Uncalled bet of (\\d+) returned to "(.+) @ (${ID})"$`).exec(text);
  if (uncalled) {
    h.events.push({ kind: "uncalled", street: h.street, player: uncalled[3], amount: Number(uncalled[1]) });
    return true;
  }

  const a = ACTOR.exec(text);
  if (!a) return false;
  const [, , player, rest] = a;
  const street = h.street;
  let m: RegExpExecArray | null;

  if ((m = /^posts an ante of (\d+)$/.exec(rest))) {
    h.events.push({ kind: "ante", street, player, amount: Number(m[1]) });
  } else if ((m = /^posts a (small blind|big blind|straddle) of (\d+)( and go all in)?$/.exec(rest))) {
    const kind = m[1] === "small blind" ? "sb" : m[1] === "big blind" ? "bb" : "straddle";
    h.events.push({ kind, street, player, amount: Number(m[2]), allIn: !!m[3] });
  } else if ((m = /^(calls|bets|raises to) (\d+)( and go all in)?$/.exec(rest))) {
    const kind = m[1] === "calls" ? "call" : m[1] === "bets" ? "bet" : "raise";
    h.events.push({ kind, street, player, amount: Number(m[2]), allIn: !!m[3] });
  } else if (rest === "folds" || rest === "checks") {
    h.events.push({ kind: rest === "folds" ? "fold" : "check", street, player });
  } else if ((m = /^shows a (.+)\.$/.exec(rest))) {
    h.events.push({ kind: "show", street, player, cards: cards(m[1]), afterHand: h.ended });
  } else if ((m = /^collected (\d+) from (?:the )?(?:main |side )?pot(?: with (.+?) \(combination: ([^)]*)\))?$/.exec(rest))) {
    const amount = Number(m[1]);
    h.events.push({ kind: "collect", street, player, amount, handName: m[2] ?? null, combo: cards(m[3] ?? "") });
    h.pot += amount;
    if (m[2]) h.showdown = true;
  } else {
    return false;
  }
  return true;
}

/** Chips put in minus chips returned must equal chips collected. Returns the difference (0 when balanced). */
export function potImbalance(h: ParsedHand): number {
  const street: Record<string, number> = {};
  let paid = 0;
  for (const e of h.events) {
    if (e.kind === "board") for (const k in street) delete street[k];
    else if (e.kind === "ante") paid += e.amount;
    else if (e.kind === "sb" || e.kind === "bb" || e.kind === "straddle" || e.kind === "call" || e.kind === "bet" || e.kind === "raise") {
      paid += e.amount - (street[e.player] ?? 0);
      street[e.player] = e.amount;
    } else if (e.kind === "uncalled") paid -= e.amount;
  }
  return paid - h.pot;
}

/** Each player's stack once the hand is over. */
export function endStacks(h: ParsedHand): Record<string, number> {
  const stacks = Object.fromEntries(h.seats.map((s) => [s.player, s.stack]));
  const street: Record<string, number> = {};
  for (const e of h.events) {
    if (e.kind === "board") for (const k in street) delete street[k];
    else if (e.kind === "ante") stacks[e.player] -= e.amount;
    else if (e.kind === "sb" || e.kind === "bb" || e.kind === "straddle" || e.kind === "call" || e.kind === "bet" || e.kind === "raise") {
      stacks[e.player] -= e.amount - (street[e.player] ?? 0);
      street[e.player] = e.amount;
    } else if (e.kind === "uncalled" || e.kind === "collect") stacks[e.player] += e.amount;
  }
  return stacks;
}

/** The player whose shown cards match "Your hand is …" most often. */
function guessHero(hands: ParsedHand[]): string | null {
  const votes = new Map<string, number>();
  for (const h of hands) {
    if (h.heroCards.length === 0) continue;
    const mine = new Set(h.heroCards);
    for (const e of h.events) {
      if (e.kind !== "show" || e.cards.length === 0 || !e.cards.every((c) => mine.has(c))) continue;
      votes.set(e.player, (votes.get(e.player) ?? 0) + 1);
    }
  }
  const ranked = [...votes].sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return null;
  // Two players showing a card from the same set is impossible, so any tie means the guess is unreliable.
  return ranked.length > 1 && ranked[1][1] === ranked[0][1] ? null : ranked[0][0];
}

export function parsePokerNowLog(csv: string): ParseResult {
  const entries = readEntries(csv);
  if (typeof entries === "string") return { hands: [], players: [], heroGuess: null, warnings: [], errors: [entries] };

  const hands: Draft[] = [];
  const warnings: string[] = [];
  const names = new Map<string, string>();
  /** Admin stack changes seen since the last hand ended: player → new stack. */
  const stackResets = new Map<number, Map<string, number>>();
  let cur: Draft | null = null;

  for (const { text, at } of entries) {
    for (const m of text.matchAll(new RegExp(PLAYER_IN.source, "g"))) names.set(m[2], m[1]);

    if (text.startsWith("-- starting hand ")) {
      if (cur && !cur.ended) warnings.push(`Hand #${cur.number} has no ending line.`);
      cur = startHand(text, at);
      if (!cur) warnings.push(`Unrecognised hand header: ${text}`);
      else hands.push(cur);
      continue;
    }
    if (/^-- ending hand #\d+ --$/.test(text)) {
      if (cur) cur.ended = true;
      continue;
    }
    // Admin set a player's stack between hands ("… stack from 2000 to 20000."): the next hand starts from it.
    const reset = new RegExp(`^The admin updated the player "(.+) @ (${ID})" stack from \\d+ to (\\d+)\\.$`).exec(text);
    if (reset) {
      const next = hands.length; // index of the hand that will start next
      if (!stackResets.has(next)) stackResets.set(next, new Map());
      stackResets.get(next)!.set(reset[2], Number(reset[3]));
      continue;
    }
    if (!cur) continue; // lobby lines before the first hand
    // Seat requests, approvals, blind/config changes… can land in the middle of a hand; none affect it.
    if (/^(The player |The admin |The game's |The game |WARNING: |Game Config)/.test(text)) continue;
    if (cur.ended) {
      // After the ending line only post-hand shows and the rabbit hunt belong to the hand; the rest is lobby.
      if (!/^".+" shows a /.test(text) && !text.startsWith("Undealt cards:")) continue;
    }
    if (!applyLine(cur, text)) warnings.push(`Hand #${cur.number}: unrecognised line: ${text}`);
  }
  if (cur && !cur.ended) {
    warnings.push(`Hand #${cur.number} has no ending line, so it was left out (the game may still be running).`);
    hands.pop();
  }

  const errors: string[] = [];
  const out: ParsedHand[] = hands.map((d) => {
    const h: Partial<Draft> = { ...d };
    delete h.street;
    delete h.ended;
    return h as ParsedHand;
  });
  out.forEach((h, i) => {
    if (h.seats.length === 0) errors.push(`Hand #${h.number} has no "Player stacks" line.`);
    const off = potImbalance(h);
    if (off !== 0) errors.push(`Hand #${h.number}: chips put in and collected differ by ${off}.`);
    // Each hand should start where the previous one ended, except for players the admin reset in between.
    const next = out[i + 1];
    if (!next) return;
    const end = endStacks(h);
    const resets = stackResets.get(i + 1);
    for (const s of next.seats) {
      if (!(s.player in end) || resets?.has(s.player)) continue;
      if (end[s.player] !== s.stack) {
        warnings.push(
          `${names.get(s.player) ?? s.player} ended hand #${h.number} with ${end[s.player]} but started #${next.number} with ${s.stack}.`,
        );
      }
    }
  });
  if (out.length === 0 && errors.length === 0) errors.push("No complete hands found in this log.");

  const counts = new Map<string, number>();
  for (const h of out) for (const s of h.seats) counts.set(s.player, (counts.get(s.player) ?? 0) + 1);
  const players = [...counts]
    .map(([id, n]) => ({ id, name: names.get(id) ?? id, hands: n }))
    .sort((a, b) => b.hands - a.hands || a.name.localeCompare(b.name));

  return { hands: out, players, heroGuess: guessHero(out), warnings, errors };
}
