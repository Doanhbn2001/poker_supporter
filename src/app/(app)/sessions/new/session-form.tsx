"use client";

import { useActionState, useState } from "react";
import { createGameSession } from "@/app/actions/sessions";
import { Button, Card, FormMessage, Input, Label, Money, Select } from "@/components/ui";
import { toCents } from "@/lib/money";

type Player = { id: string; displayName: string };
type Row = { key: number; playerId: string; buyIn: string; cashOut: string };

let nextKey = 0;
const newRow = (playerId = ""): Row => ({ key: nextKey++, playerId, buyIn: "", cashOut: "" });

export function SessionForm({ players, defaultPlayerId }: { players: Player[]; defaultPlayerId: string }) {
  const [state, action, pending] = useActionState(createGameSession, undefined);
  const [rows, setRows] = useState<Row[]>(() => [newRow(defaultPlayerId), newRow()]);
  // Controlled so React's automatic form reset doesn't wipe them when the server returns an error.
  const [meta, setMeta] = useState(() => ({
    playedAt: new Date().toLocaleDateString("en-CA"), // YYYY-MM-DD in local time
    location: "",
    notes: "",
  }));

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  // Buy-ins and cash-outs should balance; show the gap so typos are easy to spot.
  const totals = rows.reduce(
    (t, r) => ({ buyIn: t.buyIn + (toCents(r.buyIn) ?? 0), cashOut: t.cashOut + (toCents(r.cashOut) ?? 0) }),
    { buyIn: 0, cashOut: 0 },
  );
  const diff = totals.cashOut - totals.buyIn;

  return (
    <form action={action} className="space-y-6">
      <Card className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="playedAt">Date</Label>
          <Input id="playedAt" name="playedAt" type="date" required value={meta.playedAt}
            onChange={(e) => setMeta({ ...meta, playedAt: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="location">Location</Label>
          <Input id="location" name="location" placeholder="Optional" value={meta.location}
            onChange={(e) => setMeta({ ...meta, location: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="notes">Notes</Label>
          <Input id="notes" name="notes" placeholder="Optional" value={meta.notes}
            onChange={(e) => setMeta({ ...meta, notes: e.target.value })} />
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
        <p className="text-sm text-neutral-500">
          Cash-outs minus buy-ins: <Money cents={diff} />
          {diff !== 0 && " (should be 0 if everything is entered)"}
        </p>
      </Card>

      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save session"}
      </Button>
    </form>
  );
}
