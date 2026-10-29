"use client";

import { useActionState } from "react";
import { createPlayer } from "@/app/actions/players";
import { Button, FormMessage, Input, Label } from "@/components/ui";

export function AddPlayerForm() {
  const [state, action, pending] = useActionState(createPlayer, undefined);

  return (
    <form action={action} className="space-y-4" key={state?.success}>
      <div>
        <Label htmlFor="displayName">Poker name</Label>
        <Input id="displayName" name="displayName" required defaultValue={state?.values?.displayName} />
      </div>
      <div>
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" autoCapitalize="none" required defaultValue={state?.values?.username} />
      </div>
      <div>
        <Label htmlFor="password">Temporary password</Label>
        <Input id="password" name="password" type="text" minLength={8} required defaultValue={state?.values?.password} />
        <p className="mt-1 text-xs text-neutral-500">Share it with them; they can change it under their name in the top bar.</p>
      </div>
      <FormMessage error={state?.error} success={state?.success} />
      <Button type="submit" disabled={pending}>
        Add player
      </Button>
    </form>
  );
}
