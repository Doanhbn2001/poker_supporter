"use client";

import { useActionState, useState, useSyncExternalStore } from "react";
import type { SessionFormState } from "@/app/actions/sessions";
import { Button, Card, FormMessage, Input, Label, Money, Select } from "@/components/ui";
import { toCents } from "@/lib/money";

type Player = { id: string; displayName: string };
type Row = { key: number; playerId: string; buyIn: string; cashOut: string };

let nextKey = 0;
const newRow = (playerId = ""): Row => ({ key: nextKey++, playerId, buyIn: "", cashOut: "" });

export type SessionFormValues = {
  playedAt: string;
  notes: string;
  championId: string;
  results: { playerId: string; buyIn: string; cashOut: string }[];
};

type Props = {
  players: Player[];
  action: (state: SessionFormState, formData: FormData) => Promise<SessionFormState>;
  /** Existing session when editing; otherwise the form starts with the current user and one empty row. */
  initial?: SessionFormValues;
  /** Sessions already logged per date (YYYY-MM-DD), excluding the one being edited; drives the "Cup N" default. */
  cupsByDate: Record<string, number>;
  defaultPlayerId?: string;
  submitLabel?: string;
};

/** YYYY-MM-DD in the viewer's local time, `days` ago. */
const localDate = (days = 0) => {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA");
};

// "Today" only exists on the client: the server's timezone can be a day off from the player's.
const noopSubscribe = () => () => {};
const useToday = () => useSyncExternalStore(noopSubscribe, () => localDate(), () => "");

function DateField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = useToday();
  const day = new Date().getDay();
  // Most recent Saturday / Sunday on or before today: the group plays on weekends.
  const shortcuts = today
    ? [
        { label: "Today", value: today },
        { label: "Last Sat", value: localDate((day + 1) % 7) },
        { label: "Last Sun", value: localDate(day) },
      ]
    : [];
  const long = value
    ? new Date(`${value}T00:00:00Z`).toLocaleDateString("en-GB", { timeZone: "UTC", dateStyle: "full" })
    : "";

  return (
    <div>
      <Label htmlFor="playedAt">Date</Label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-52">
          <svg
            viewBox="0 0 20 20"
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-500"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
          >
            <rect x="3" y="4.5" width="14" height="12.5" rx="2" />
            <path d="M3 8.5h14M7 2.5v4M13 2.5v4" strokeLinecap="round" />
          </svg>
          <Input
            id="playedAt"
            name="playedAt"
            type="date"
            required
            value={value}
            max={today || undefined}
            onChange={(e) => onChange(e.target.value)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker();
              } catch {
                // Unsupported or blocked: the native field still works by typing.
              }
            }}
            className="cursor-pointer pl-9 tabular-nums [&::-webkit-calendar-picker-indicator]:hidden"
          />
        </div>
        {shortcuts.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onChange(s.value)}
            aria-pressed={value === s.value}
            className={`rounded-full border px-3 py-1 text-xs ${
              value === s.value
                ? "border-emerald-600 bg-emerald-600 text-white"
                : "border-neutral-300 text-neutral-600 hover:border-emerald-600 dark:border-neutral-700 dark:text-neutral-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
      {long && <p className="mt-1 text-xs text-neutral-500">{long}</p>}
    </div>
  );
}

export function SessionForm({
  players,
  action: submit,
  initial,
  cupsByDate,
  defaultPlayerId = "",
  submitLabel = "Save session",
}: Props) {
  const [state, action, pending] = useActionState(submit, undefined);
  const [rows, setRows] = useState<Row[]>(() =>
    initial
      ? initial.results.map((r) => ({ ...newRow(r.playerId), buyIn: r.buyIn, cashOut: r.cashOut }))
      : [newRow(defaultPlayerId), newRow()],
  );
  // Controlled so React's automatic form reset doesn't wipe them when the server returns an error.
  // A new session defaults to today once the client knows the local date.
  const today = useToday();
  const [pickedDate, setPickedDate] = useState(initial?.playedAt ?? "");
  const playedAt = pickedDate || today;
  const [champion, setChampion] = useState(initial?.championId ?? "");
  // Until the name is typed it follows the date: the next free "Cup N" of that day.
  const [typedCup, setTypedCup] = useState<string | null>(initial?.notes || null);
  const cupName = typedCup ?? (playedAt ? `Cup ${(cupsByDate[playedAt] ?? 0) + 1}` : "");

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // The champion must be in the session; if their row goes away the choice falls back to none.
  const inSession = players.filter((p) => rows.some((r) => r.playerId === p.id));
  const championId = inSession.some((p) => p.id === champion) ? champion : "";

  // Buy-ins and cash-outs should balance; show the gap so typos are easy to spot.
  const totals = rows.reduce(
    (t, r) => ({ buyIn: t.buyIn + (toCents(r.buyIn) ?? 0), cashOut: t.cashOut + (toCents(r.cashOut) ?? 0) }),
    { buyIn: 0, cashOut: 0 },
  );
  const diff = totals.cashOut - totals.buyIn;

  return (
    <form action={action} className="space-y-6">
      <Card className="space-y-4">
        <DateField value={playedAt} onChange={setPickedDate} />
        <div>
          <Label htmlFor="notes">Cup</Label>
          <Input id="notes" name="notes" maxLength={40} placeholder="Cup 1" value={cupName}
            onChange={(e) => setTypedCup(e.target.value)} className="sm:w-52" />
          <p className="mt-1 text-xs text-neutral-500">
            Numbered per day by default; left empty it becomes the next cup of that day.
          </p>
        </div>
      </Card>

      <Card className="space-y-3">
        <div className="grid grid-cols-[1fr_6rem_6rem_2rem] gap-2 text-sm font-medium text-neutral-500">
          <span>Player</span>
          <span>Buy-in</span>
          <span>Cash-out</span>
          <span />
        </div>
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[1fr_6rem_6rem_2rem] items-center gap-2">
            <Select name="playerId" value={row.playerId} onChange={(e) => update(row.key, { playerId: e.target.value })}>
              <option value="">Choose…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.displayName}
                </option>
              ))}
            </Select>
            <Input name="buyIn" inputMode="decimal" placeholder="0" value={row.buyIn}
              onChange={(e) => update(row.key, { buyIn: e.target.value })} />
            <Input name="cashOut" inputMode="decimal" placeholder="0" value={row.cashOut}
              onChange={(e) => update(row.key, { cashOut: e.target.value })} />
            <button type="button" aria-label="Remove row" className="text-neutral-400 hover:text-red-600"
              onClick={() => setRows((rs) => rs.filter((r) => r.key !== row.key))}>
              ✕
            </button>
          </div>
        ))}
        <button type="button" className="text-sm font-medium text-emerald-600 hover:underline"
          onClick={() => setRows((rs) => [...rs, newRow()])}>
          + Add player
        </button>
        <p className={`text-sm ${diff === 0 ? "text-neutral-500" : "text-red-600"}`}>
          Cash-outs minus buy-ins: <Money cents={diff} />
          {diff !== 0 && " — must be 0 before saving"}
        </p>
      </Card>

      <Card>
        <Label htmlFor="championId">👑 Champion</Label>
        <Select id="championId" name="championId" value={championId} onChange={(e) => setChampion(e.target.value)}
          className="sm:w-64">
          <option value="">— None —</option>
          {inSession.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </Select>
        <p className="mt-1 text-xs text-neutral-500">Picking a champion adds a crown to that player.</p>
      </Card>

      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending || diff !== 0}>
        {pending ? "Saving…" : submitLabel}
      </Button>
    </form>
  );
}
