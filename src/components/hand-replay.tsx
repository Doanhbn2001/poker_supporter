"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CardRow } from "@/components/playing-card";
import type { ParsedHand, Street } from "@/lib/pokernow/parse";
import { equity } from "@/lib/pokernow/equity";
import { buildFrames, describeEvent, formatChips, type Frame } from "@/lib/pokernow/replay";

type Props = {
  hand: ParsedHand;
  /** Poker Now id → display name (and linked player). */
  players: Record<string, { name: string; userId: string | null }>;
  /** Poker Now id of the log owner; their cards are in hand.heroCards when the viewer may see them. */
  hero: string | null;
  prevHref: string | null;
  nextHref: string | null;
};

const STREETS: Street[] = ["preflop", "flop", "turn", "river"];
const STREET_LABEL: Record<Street, string> = { preflop: "Preflop", flop: "Flop", turn: "Turn", river: "River" };
const isPost = (kind: string) => kind === "ante" || kind === "sb" || kind === "bb" || kind === "straddle";

export function HandReplay({ hand, players, hero, prevHref, nextHref }: Props) {
  const frames = useMemo(() => buildFrames(hand), [hand]);
  const last = frames.length - 1;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const frame = frames[step];
  const name = (id: string) => players[id]?.name ?? id;

  /** Event index → frame index; the blinds and antes all live in frame 0. */
  const frameOf = useMemo(() => {
    const m = new Map<number, number>();
    frames.forEach((f, i) => m.set(f.event, i));
    hand.events.forEach((e, i) => {
      if (isPost(e.kind) && i <= frames[0].event) m.set(i, 0);
    });
    return m;
  }, [frames, hand.events]);

  // Known hole cards from the start: the log owner's (if visible) plus anything shown during or after the hand.
  const holeCount = hand.heroCards.length || 2;
  const known = useMemo(() => {
    const k: Record<string, string[]> = {};
    for (const e of hand.events) if (e.kind === "show") k[e.player] = [...new Set([...(k[e.player] ?? []), ...e.cards])];
    if (hero && hand.heroCards.length > 0) k[hero] = hand.heroCards;
    return k;
  }, [hand, hero]);

  // Each player's chance to win from this point, when every player still in has known cards.
  const equities = useMemo(() => {
    const cache = new Map<string, Record<string, number>>();
    return frames.map((f) => {
      const active = hand.seats.map((s) => s.player).filter((p) => !f.folded.includes(p));
      if (active.length < 2 || active.some((p) => (known[p]?.length ?? 0) < holeCount)) return null;
      const key = `${active.join(",")}|${f.board.join(",")}`;
      if (!cache.has(key)) {
        const eq = equity(active.map((p) => known[p]), f.board);
        cache.set(key, Object.fromEntries(active.map((p, i) => [p, eq[i]])));
      }
      return cache.get(key)!;
    });
  }, [frames, hand.seats, known, holeCount]);

  // When the last chips went in with someone all in: everyone's equity at that moment.
  const allInEquity = useMemo(() => {
    for (let i = frames.length - 1; i > 0; i--) {
      const e = hand.events[frames[i].event];
      if (e.kind !== "call" && e.kind !== "bet" && e.kind !== "raise") continue;
      const active = hand.seats.filter((s) => !frames[i].folded.includes(s.player));
      return active.some((s) => frames[i].allIn.includes(s.player)) ? equities[i] : null;
    }
    return null;
  }, [frames, hand, equities]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
      const to = { ArrowRight: step + 1, ArrowLeft: step - 1, Home: 0, End: last }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      setPlaying(false);
      setStep(Math.min(last, Math.max(0, to)));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, last]);

  useEffect(() => {
    if (!playing || step >= last) return;
    const t = setTimeout(() => {
      setStep(step + 1);
      if (step + 1 >= last) setPlaying(false);
    }, 900);
    return () => clearTimeout(t);
  }, [playing, step, last]);

  // Keep the current action visible in the log without scrolling the page.
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = logRef.current;
    const row = box?.querySelector<HTMLElement>("[data-current=true]");
    if (!box || !row) return;
    if (row.offsetTop < box.scrollTop || row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight) {
      box.scrollTop = row.offsetTop - box.clientHeight / 2;
    }
  }, [step]);

  const go = (to: number) => {
    setPlaying(false);
    setStep(Math.min(last, Math.max(0, to)));
  };
  const caption = step === 0 ? "Blinds and antes posted" : describeEvent(hand.events[frame.event], name);
  const decision = step > 0 ? potOdds(hand, frames[step - 1], frame, equities[step - 1]) : null;
  const collects = hand.events.flatMap((e) => (e.kind === "collect" ? [e] : []));

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-3">
        <Table
          hand={hand}
          frame={frame}
          hero={hero}
          name={name}
          known={known}
          holeCount={holeCount}
          atEnd={step === last}
          equity={step === last ? null : equities[step]}
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <CtrlButton label="First step (Home)" onClick={() => go(0)} disabled={step === 0}>⏮</CtrlButton>
            <CtrlButton label="Previous step (←)" onClick={() => go(step - 1)} disabled={step === 0}>◀</CtrlButton>
            <CtrlButton
              label={playing ? "Pause" : "Play"}
              onClick={() => (step >= last ? (setStep(0), setPlaying(true)) : setPlaying(!playing))}
            >
              {playing ? "⏸" : "▶︎"}
            </CtrlButton>
            <CtrlButton label="Next step (→)" onClick={() => go(step + 1)} disabled={step === last}>▶</CtrlButton>
            <CtrlButton label="Last step (End)" onClick={() => go(last)} disabled={step === last}>⏭</CtrlButton>
            <span className="ml-2 text-sm text-neutral-500 tabular-nums">
              {step + 1}/{frames.length}
            </span>
          </div>
          <div className="flex gap-3 text-sm">
            {prevHref ? (
              <Link href={prevHref} className="font-medium text-emerald-600 hover:underline">← Previous hand</Link>
            ) : (
              <span className="text-neutral-400">← Previous hand</span>
            )}
            {nextHref ? (
              <Link href={nextHref} className="font-medium text-emerald-600 hover:underline">Next hand →</Link>
            ) : (
              <span className="text-neutral-400">Next hand →</span>
            )}
          </div>
        </div>
        <div className="rounded-lg bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800" aria-live="polite">
          <p className="font-medium">{caption}</p>
          {decision && (
            <p className="mt-1 text-neutral-600 dark:text-neutral-300">
              Phải bỏ thêm {formatChips(decision.toCall)} để theo pot {formatChips(decision.pot)}: cần thắng ít nhất{" "}
              <b>{Math.round(decision.need * 100)}%</b> mới đáng call.
              {decision.equity !== null && (
                <>
                  {" "}
                  Với bài thật của đối thủ, {name(decision.player)} có <b>{Math.round(decision.equity * 100)}%</b>
                  {decision.kind === "call"
                    ? decision.equity >= decision.need
                      ? ", call có lời về lâu dài."
                      : ", call lỗ về lâu dài."
                    : decision.equity > decision.need
                      ? ", fold là bỏ lỡ (dù lúc chơi không thể biết bài đối thủ)."
                      : ", fold là hợp lý."}
                </>
              )}
            </p>
          )}
        </div>

        {step === last && collects.length > 0 && (
          <div className="space-y-2 rounded-xl border border-neutral-200 p-4 text-sm dark:border-neutral-800">
            {allInEquity && (
              <p className="text-neutral-600 dark:text-neutral-300">
                Lúc all-in:{" "}
                {Object.entries(allInEquity)
                  .sort((a, b) => b[1] - a[1])
                  .map(([p, eq]) => `${name(p)} ${Math.round(eq * 100)}%`)
                  .join(" · ")}
              </p>
            )}
            {collects.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{name(c.player)}</span>
                <span>wins {formatChips(c.amount)}</span>
                {c.handName && <span className="text-neutral-500">with {c.handName}</span>}
                {c.combo.length > 0 && <CardRow cards={c.combo} small />}
              </div>
            ))}
          </div>
        )}
      </div>

      <div
        ref={logRef}
        className="relative max-h-[28rem] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2 text-sm shadow-sm lg:max-h-[calc(100dvh_-_12rem)] dark:border-neutral-800 dark:bg-neutral-900"
      >
        <button
          type="button"
          data-current={step === 0}
          onClick={() => go(0)}
          className={`block w-full rounded px-2 py-1 text-left ${step === 0 ? "bg-emerald-600 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"}`}
        >
          Blinds and antes
        </button>
        {STREETS.map((street) => {
          const items = hand.events
            .map((e, i) => ({ e, i }))
            .filter(({ e, i }) => e.street === street && !(isPost(e.kind) && frameOf.get(i) === 0) && e.kind !== "board");
          const board = hand.events.findIndex((e) => e.kind === "board" && e.street === street);
          if (items.length === 0 && board < 0) return null;
          return (
            <div key={street} className="mt-2">
              <button
                type="button"
                disabled={board < 0}
                onClick={() => board >= 0 && go(frameOf.get(board) ?? 0)}
                data-current={board >= 0 && frameOf.get(board) === step}
                className={`flex w-full items-center gap-2 rounded px-2 py-1 text-xs font-semibold tracking-wide text-neutral-500 uppercase ${
                  board >= 0 && frameOf.get(board) === step ? "bg-emerald-600 text-white" : ""
                }`}
              >
                {STREET_LABEL[street]}
                {board >= 0 && hand.events[board].kind === "board" && (
                  <span className="font-normal normal-case">{(hand.events[board] as { cards: string[] }).cards.join(" ")}</span>
                )}
              </button>
              {items.map(({ e, i }) => {
                const f = frameOf.get(i) ?? 0;
                return (
                  <button
                    key={i}
                    type="button"
                    data-current={f === step}
                    onClick={() => go(f)}
                    className={`block w-full rounded px-2 py-1 text-left ${
                      f === step ? "bg-emerald-600 text-white" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    } ${f > step ? "opacity-60" : ""}`}
                  >
                    {describeEvent(e, name)}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CtrlButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="h-9 w-9 rounded-lg border border-neutral-300 text-sm hover:border-emerald-600 disabled:opacity-40 dark:border-neutral-700"
    >
      {children}
    </button>
  );
}

function Table({
  hand,
  frame,
  hero,
  name,
  known,
  holeCount,
  atEnd,
  equity,
}: {
  hand: ParsedHand;
  frame: Frame;
  hero: string | null;
  name: (id: string) => string;
  known: Record<string, string[]>;
  holeCount: number;
  atEnd: boolean;
  equity: Record<string, number> | null;
}) {
  // Seats clockwise from the bottom centre, starting with the log owner when they're at the table.
  const seats = [...hand.seats].sort((a, b) => a.seat - b.seat);
  const start = Math.max(0, seats.findIndex((s) => s.player === hero));
  const ordered = [...seats.slice(start), ...seats.slice(0, start)];
  const totalBets = Object.values(frame.bets).reduce((a, b) => a + b, 0);
  const at = (i: number, rx: number, ry: number) => {
    const a = Math.PI / 2 + (2 * Math.PI * i) / ordered.length;
    return { left: `${50 + rx * Math.cos(a)}%`, top: `${50 + ry * Math.sin(a)}%` };
  };

  return (
    <div className="relative mx-auto aspect-[4/5] w-full max-w-3xl sm:aspect-[16/10]">
      <div className="absolute inset-[13%] rounded-[50%] border-[6px] border-emerald-950/80 bg-emerald-700 shadow-inner dark:bg-emerald-800" />

      <div className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2">
        <div className="flex min-h-12 items-center gap-1">
          {frame.board.length > 0 && <CardRow cards={frame.board} />}
          {atEnd && hand.undealt.length > 0 && (
            <span title="Rabbit hunt: the cards that would have come">
              <CardRow cards={hand.undealt} dim={hand.undealt} />
            </span>
          )}
        </div>
        <div className="rounded-full bg-black/30 px-3 py-0.5 text-xs font-medium text-white tabular-nums">
          Pot {formatChips(frame.pot)}
          {totalBets > 0 && <span className="text-white/70"> · total {formatChips(frame.pot + totalBets)}</span>}
        </div>
      </div>

      {ordered.map((s, i) => {
        const bet = frame.bets[s.player] ?? 0;
        return bet > 0 ? (
          <div
            key={`bet-${s.player}`}
            style={at(i, 25, 22)}
            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 px-2 py-0.5 text-xs font-semibold text-neutral-900 shadow tabular-nums"
          >
            {formatChips(bet)}
          </div>
        ) : null;
      })}

      {ordered.map((s, i) => {
        const folded = frame.folded.includes(s.player);
        const cards = known[s.player];
        const hole = cards
          ? [...cards, ...Array(Math.max(0, holeCount - cards.length)).fill("?")]
          : folded
            ? []
            : Array(holeCount).fill("?");
        const won = frame.won[s.player];
        return (
          <div
            key={s.player}
            style={at(i, 42, 42)}
            className={`absolute flex w-24 -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1 sm:w-28 ${folded ? "opacity-45" : ""}`}
          >
            <div className="flex h-8 items-end">{hole.length > 0 && <CardRow cards={hole} small />}</div>
            <div
              className={`relative w-full rounded-lg border bg-white px-2 py-1 text-center shadow-sm dark:bg-neutral-900 ${
                frame.actor === s.player
                  ? "border-emerald-500 ring-2 ring-emerald-500"
                  : "border-neutral-200 dark:border-neutral-700"
              }`}
            >
              {hand.dealer === s.player && (
                <span
                  title="Dealer"
                  className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-white text-[10px] font-bold text-neutral-900 shadow ring-1 ring-neutral-300"
                >
                  D
                </span>
              )}
              <div className={`truncate text-xs font-medium ${s.player === hero ? "text-emerald-600" : ""}`}>{name(s.player)}</div>
              <div className="text-xs text-neutral-500 tabular-nums">
                {frame.allIn.includes(s.player) && frame.stacks[s.player] === 0 ? "All in" : formatChips(frame.stacks[s.player])}
              </div>
              {won ? <div className="text-xs font-semibold text-emerald-600 tabular-nums">+{formatChips(won)}</div> : null}
              {equity && s.player in equity && (
                <div
                  title="Chance to win from here"
                  className="mx-auto mt-0.5 w-fit rounded-full bg-sky-600 px-1.5 text-[10px] font-semibold text-white tabular-nums"
                >
                  {Math.round(equity[s.player] * 100)}% win
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * For a call or fold that faced a bet: the chips needed, the pot before acting, and the share of the final pot a
 * call has to win to break even. `before` is the frame just before the action.
 */
function potOdds(hand: ParsedHand, before: Frame, after: Frame, eq: Record<string, number> | null) {
  const e = hand.events[after.event];
  if (e.kind !== "call" && e.kind !== "fold") return null;
  const bets = Object.values(before.bets);
  const toCall = Math.min(Math.max(0, ...bets) - (before.bets[e.player] ?? 0), before.stacks[e.player]);
  if (toCall <= 0) return null;
  const pot = before.pot + bets.reduce((a, b) => a + b, 0);
  return { kind: e.kind, player: e.player, toCall, pot, need: toCall / (pot + toCall), equity: eq?.[e.player] ?? null };
}
