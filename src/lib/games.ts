/** Game kinds as stored in GameSession.type. Plain strings so client components can use them too. */
export type GameKind = "CUP" | "CASH";

/** Per-kind route base and wording. */
export const GAME = {
  CUP: { base: "/cups", noun: "cup", Noun: "Cup", plural: "Cups", prefix: "Cup" },
  CASH: { base: "/cash", noun: "cash game", Noun: "Cash game", plural: "Cash games", prefix: "Cash" },
} as const satisfies Record<GameKind, { base: string; noun: string; Noun: string; plural: string; prefix: string }>;

/** Default game name: "Cup YYYY/MM/DD N" or "Cash YYYY/MM/DD N", N numbering that day's games of the kind from 1. */
export const defaultGameName = (kind: GameKind, date: string, n: number) =>
  `${GAME[kind].prefix} ${date.replaceAll("-", "/")} ${n}`;

/** True for a default name generated for a day other than `date` (so it should follow a date change). */
export const isDefaultNameForOtherDay = (name: string, date: string) => {
  const m = /^(?:Cup|Cash) (\d{4}\/\d{2}\/\d{2}) \d+$/.exec(name);
  return m !== null && m[1] !== date.replaceAll("-", "/");
};
