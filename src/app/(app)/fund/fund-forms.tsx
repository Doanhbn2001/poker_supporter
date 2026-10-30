"use client";

import { useActionState, useState, useSyncExternalStore, useTransition } from "react";
import { createTransaction, settleAll, type FundFormState } from "@/app/actions/fund";
import { Button, FormMessage, Input, Label, Select } from "@/components/ui";

// "Today" only exists on the client: the server's timezone can be a day off from the player's.
const noopSubscribe = () => () => {};
const useToday = () => useSyncExternalStore(noopSubscribe, () => new Date().toLocaleDateString("en-CA"), () => "");

/** Date input that defaults to today once the client knows it, and stays controlled across server errors. */
function DayInput({ id }: { id: string }) {
  const today = useToday();
  const [picked, setPicked] = useState("");
  return (
    <Input id={id} name="happenedAt" type="date" required value={picked || today} max={today || undefined}
      onChange={(e) => setPicked(e.target.value)} />
  );
}

/** `ids` are the transactions still on record; the success message goes away if its entry is deleted. */
export function TransactionForm({ players, ids }: { players: { id: string; displayName: string }[]; ids: string[] }) {
  const [state, action, pending] = useActionState<FundFormState, FormData>(createTransaction, undefined);
  const success = state?.id && ids.includes(state.id) ? state.success : undefined;
  return (
    // Remount after a success so the fields clear for the next entry.
    <form action={action} className="space-y-4" key={state?.success}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="userId">Player</Label>
          <Select id="userId" name="userId" required defaultValue="">
            <option value="" disabled>Choose…</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="kind">Type</Label>
          <Select id="kind" name="kind" defaultValue="DEPOSIT">
            <option value="DEPOSIT">Deposit (pays into the fund)</option>
            <option value="WITHDRAW">Withdraw (takes money out)</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" inputMode="decimal" placeholder="0" required />
        </div>
        <div>
          <Label htmlFor="txDate">Date</Label>
          <DayInput id="txDate" />
        </div>
      </div>
      <div>
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" name="note" maxLength={100} placeholder="e.g. Mai đưa Trường 500" />
      </div>
      <FormMessage error={state?.error} success={success} />
      <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Record"}</Button>
    </form>
  );
}

export function SettleAllForm({ count }: { count: number }) {
  const [state, action, pending] = useActionState<FundFormState, FormData>(settleAll, undefined);
  return (
    <form
      action={action}
      className="space-y-3"
      onSubmit={(e) => {
        if (!confirm(`Ghi nạp/rút cho cả ${count} người để tất cả ví về 0?`)) e.preventDefault();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="settleDate">Date</Label>
          <DayInput id="settleDate" />
        </div>
        <Button type="submit" disabled={pending || count === 0}>{pending ? "Settling…" : "Settle everyone"}</Button>
      </div>
      <FormMessage error={state?.error} success={state?.success} />
    </form>
  );
}

export function DeleteTransactionButton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-neutral-400 hover:text-red-600 disabled:opacity-50"
      onClick={() => {
        if (confirm("Delete this entry?")) startTransition(() => action());
      }}
    >
      {pending ? "…" : "Delete"}
    </button>
  );
}
