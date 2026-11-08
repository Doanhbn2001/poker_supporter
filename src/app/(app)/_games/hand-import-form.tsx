"use client";

import { useActionState, useState } from "react";
import type { HandLogFormState } from "@/app/actions/hands";
import { Button, Card, FormMessage, Label, Select } from "@/components/ui";
import { parsePokerNowLog, type ParseResult } from "@/lib/pokernow/parse";

type User = { id: string; displayName: string };

type Props = {
  users: User[];
  /** Poker Now id → user id, remembered from earlier imports. */
  aliases: Record<string, string>;
  /** Hands already imported into this game (they get replaced). */
  existingHands: number;
  action: (state: HandLogFormState, formData: FormData) => Promise<HandLogFormState>;
};

const norm = (s: string) => s.trim().toLocaleLowerCase();

export function HandImportForm({ users, aliases, existingHands, action }: Props) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [csv, setCsv] = useState("");
  const [result, setResult] = useState<ParseResult | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [hero, setHero] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    const parsed = parsePokerNowLog(text);
    setCsv(text);
    setResult(parsed);
    // Pre-fill each Poker Now player: a remembered link first, else a player with the same poker name.
    const byName = new Map(users.map((u) => [norm(u.displayName), u.id]));
    const taken = new Set<string>();
    const next: Record<string, string> = {};
    for (const p of parsed.players) {
      const guess = aliases[p.id] ?? byName.get(norm(p.name)) ?? "";
      next[p.id] = guess && !taken.has(guess) ? guess : "";
      if (next[p.id]) taken.add(next[p.id]);
    }
    setLinks(next);
    setHero(parsed.heroGuess ?? "");
  }

  const blocked = !result || result.errors.length > 0 || result.hands.length === 0;
  const linked = Object.values(links).filter(Boolean);
  const duplicate = new Set(linked).size !== linked.length;

  return (
    <form action={formAction} className="space-y-6">
      <Card className="space-y-3">
        <Label htmlFor="log">Poker Now log (.csv)</Label>
        <input
          id="log"
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-600 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-emerald-700"
        />
        <p className="text-sm text-neutral-500">
          In Poker Now, open the game&apos;s log and click <b>Download full log</b>. Hole cards in the log belong to whoever
          downloaded it; only they and admins will see them.
        </p>
        {existingHands > 0 && (
          <p className="text-sm text-amber-600">
            This game already has {existingHands} imported hands. Importing replaces them.
          </p>
        )}
      </Card>

      {result && (
        <Card className="space-y-4">
          <p className="text-sm">
            <b>{result.hands.length}</b> hands
            {result.hands.length > 0 && (
              <>
                {" "}
                (#{result.hands[0].number}–#{result.hands.at(-1)!.number}),{" "}
                {result.hands.filter((h) => h.showdown).length} went to showdown
              </>
            )}
            .
          </p>
          {result.errors.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm text-red-600">
              {result.errors.slice(0, 10).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
          {result.warnings.length > 0 && (
            <details className="text-sm text-amber-600">
              <summary className="cursor-pointer">{result.warnings.length} warnings (the import can still go ahead)</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.warnings.slice(0, 50).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          )}

          {result.players.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-neutral-500">
                  <tr className="border-b border-neutral-200 dark:border-neutral-800">
                    <th className="py-2 pr-3">Poker Now player</th>
                    <th className="py-2 pr-3 text-right">Hands</th>
                    <th className="py-2 pr-3">App player</th>
                    <th className="py-2 text-center">Log owner</th>
                  </tr>
                </thead>
                <tbody>
                  {result.players.map((p) => (
                    <tr key={p.id} className="border-b border-neutral-100 dark:border-neutral-800">
                      <td className="py-2 pr-3">
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-neutral-500">{p.id}</div>
                      </td>
                      <td className="py-2 pr-3 text-right tabular-nums">{p.hands}</td>
                      <td className="py-2 pr-3">
                        <Select
                          name={`user:${p.id}`}
                          value={links[p.id] ?? ""}
                          onChange={(e) => setLinks({ ...links, [p.id]: e.target.value })}
                          className="min-w-40"
                        >
                          <option value="">— Not linked —</option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.displayName}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="radio"
                          name="hero"
                          value={p.id}
                          checked={hero === p.id}
                          onChange={() => setHero(p.id)}
                          aria-label={`${p.name} downloaded this log`}
                          className="accent-emerald-600"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-neutral-500">
                {result.heroGuess
                  ? "The log owner was worked out from the showdowns; change it if it's wrong."
                  : "Couldn't tell who downloaded this log: pick the log owner, or their hole cards stay hidden from them."}
              </p>
            </div>
          )}
          {duplicate && <FormMessage error="Each app player can only be linked to one Poker Now player." />}
        </Card>
      )}

      <input type="hidden" name="csv" value={csv} />
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={blocked || duplicate || pending}>
        {pending ? "Importing…" : result && !blocked ? `Import ${result.hands.length} hands` : "Import"}
      </Button>
    </form>
  );
}
