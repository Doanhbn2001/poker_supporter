import Link from "next/link";
import { insights, MIN_HANDS_FOR_INSIGHTS, ratios, type PlayStats } from "@/lib/pokernow/stats";

/** Column definitions with a Vietnamese explanation on hover, like the Guide page's wording. */
const COLUMNS = [
  { key: "vpip", label: "VPIP", help: "Tỉ lệ hand tự bỏ tiền vào pot trước flop (call hoặc raise; blind bắt buộc không tính)." },
  { key: "pfr", label: "PFR", help: "Tỉ lệ hand raise trước flop. Càng gần VPIP thì càng chủ động." },
  { key: "threeBet", label: "3-bet", help: "Khi có người raise trước flop, bao nhiêu lần bạn re-raise." },
  { key: "af", label: "AF", help: "Mức hung hăng sau flop: (bet + raise) / call. Dưới 1 là thụ động, 2–3 là cân bằng." },
  { key: "wtsd", label: "WTSD", help: "Trong các hand đã xem flop, bao nhiêu lần đi tới showdown." },
  { key: "wsd", label: "W$SD", help: "Khi tới showdown, bao nhiêu lần thắng (ít nhất một phần pot)." },
  { key: "bb100", label: "bb/100", help: "Chip thắng/thua tính theo big blind, trung bình mỗi 100 hand." },
] as const;

const fmt = (key: (typeof COLUMNS)[number]["key"], v: number | null) => {
  if (v === null) return "–";
  if (key === "af") return v === Infinity ? "∞" : v.toFixed(1);
  if (key === "bb100") return `${v > 0 ? "+" : ""}${Math.round(v)}`;
  return `${Math.round(v)}%`;
};

export type PlayStatsRow = { id: string; name: string; href?: string; stats: PlayStats };

/** One row per player: hands and the usual HUD stats. */
export function PlayStatsTable({ rows }: { rows: PlayStatsRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <table className="w-full text-sm">
        <thead className="text-left text-neutral-500">
          <tr className="border-b border-neutral-200 dark:border-neutral-800">
            <th className="px-4 py-2">Player</th>
            <th className="px-3 py-2 text-right">Hands</th>
            {COLUMNS.map((c) => (
              <th key={c.key} className="px-3 py-2 text-right" title={c.help}>
                <span className="cursor-help border-b border-dotted border-neutral-400">{c.label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const r = ratios(row.stats);
            return (
              <tr key={row.id} className="border-b border-neutral-100 last:border-0 dark:border-neutral-800">
                <td className="px-4 py-2 font-medium whitespace-nowrap">
                  {row.href ? (
                    <Link href={row.href} className="hover:underline">
                      {row.name}
                    </Link>
                  ) : (
                    row.name
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{row.stats.hands}</td>
                {COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2 text-right tabular-nums ${
                      c.key === "bb100" && r.bb100 !== null ? (r.bb100 > 0 ? "text-emerald-600" : r.bb100 < 0 ? "text-red-600" : "") : ""
                    }`}
                  >
                    {fmt(c.key, r[c.key])}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Leak notes for each player who has enough hands. */
export function PlayInsights({ rows }: { rows: PlayStatsRow[] }) {
  const withNotes = rows.map((row) => ({ row, notes: insights(row.stats) }));
  const shown = withNotes.filter((x) => x.notes.length > 0);
  const tooFew = rows.filter((r) => r.stats.hands < MIN_HANDS_FOR_INSIGHTS);
  if (shown.length === 0 && tooFew.length === 0) {
    return <p className="text-sm text-neutral-500">Không thấy điểm yếu rõ ràng nào theo các chỉ số trên.</p>;
  }
  return (
    <div className="space-y-3 text-sm">
      {shown.map(({ row, notes }) => (
        <div key={row.id}>
          {rows.length > 1 && <div className="font-medium">{row.name}</div>}
          <ul className="list-disc space-y-1 pl-5 text-neutral-700 dark:text-neutral-300">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </div>
      ))}
      {tooFew.length > 0 && (
        <p className="text-xs text-neutral-500">
          Chưa đủ {MIN_HANDS_FOR_INSIGHTS} hand để nhận xét: {tooFew.map((r) => r.name).join(", ")}.
        </p>
      )}
      <p className="text-xs text-neutral-500">
        Nhận xét dựa trên quy tắc chung, chỉ để tham khảo. Số liệu đáng tin hơn khi cộng dồn nhiều buổi.
      </p>
    </div>
  );
}
