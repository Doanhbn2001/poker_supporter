// Parses a Poker Now CSV log and reports what an import would see, without touching the database.
//   npm run hands:check -- path/to/poker_now_log_xxx.csv
// Exits with 1 if the log has errors that would block the import.
import { readFileSync } from "node:fs";
import { parsePokerNowLog } from "../src/lib/pokernow/parse";
import { buildFrames } from "../src/lib/pokernow/replay";
import { computeStats, insights, ratios } from "../src/lib/pokernow/stats";

const file = process.argv[2];
if (!file) {
  console.error("Usage: npm run hands:check -- <poker_now_log.csv>");
  process.exit(2);
}

const r = parsePokerNowLog(readFileSync(file, "utf8"));
const name = (id: string | null) => r.players.find((p) => p.id === id)?.name ?? id ?? "?";

console.log(`Hands:      ${r.hands.length} (#${r.hands[0]?.number ?? "-"} → #${r.hands.at(-1)?.number ?? "-"})`);
console.log(`Showdowns:  ${r.hands.filter((h) => h.showdown).length}`);
console.log(`Log owner:  ${r.heroGuess ? name(r.heroGuess) : "unknown (pick it when importing)"}`);
console.log("Players:");
for (const p of r.players) console.log(`  ${p.name.padEnd(24)} ${p.id.padEnd(12)} ${p.hands} hands`);

// The replay must end every hand on the same stacks as the chip arithmetic in the parser.
let replayErrors = 0;
for (const h of r.hands) {
  try {
    const last = buildFrames(h).at(-1)!;
    if (last.pot !== 0 || Object.values(last.bets).some((b) => b !== 0)) {
      replayErrors++;
      console.log(`  replay: hand #${h.number} ends with chips left on the table`);
    }
  } catch (e) {
    replayErrors++;
    console.log(`  replay: hand #${h.number} failed: ${(e as Error).message}`);
  }
}

const stats = computeStats(r.hands);
const pct = (v: number | null) => (v === null ? "  –" : `${Math.round(v)}%`.padStart(4));
console.log("Playing style:        hands VPIP  PFR 3bet   AF WTSD W$SD bb/100");
for (const p of r.players) {
  const s = stats[p.id];
  const x = ratios(s);
  const af = x.af === null ? "–" : x.af === Infinity ? "∞" : x.af.toFixed(1);
  console.log(
    `  ${p.name.padEnd(20)} ${String(s.hands).padStart(5)} ${pct(x.vpip)} ${pct(x.pfr)} ${pct(x.threeBet)} ${af.padStart(4)} ${pct(x.wtsd)} ${pct(x.wsd)} ${String(Math.round(x.bb100 ?? 0)).padStart(6)}`,
  );
  for (const note of insights(s)) console.log(`      - ${note}`);
}

console.log(`Warnings:   ${r.warnings.length}`);
for (const w of r.warnings) console.log(`  ${w}`);
console.log(`Errors:     ${r.errors.length + replayErrors}`);
for (const e of r.errors) console.log(`  ${e}`);
process.exit(r.errors.length + replayErrors > 0 ? 1 : 0);
