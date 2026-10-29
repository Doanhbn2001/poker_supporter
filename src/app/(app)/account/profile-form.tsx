"use client";

import { useActionState } from "react";
import { updateProfile } from "@/app/actions/players";
import { Button, FormMessage, Input, Label } from "@/components/ui";

export function ProfileForm({ displayName, motto }: { displayName: string; motto: string }) {
  const [state, action, pending] = useActionState(updateProfile, undefined);
  const values = state?.values ?? { displayName, motto };

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="displayName">Poker name</Label>
        <Input id="displayName" name="displayName" required maxLength={40} defaultValue={values.displayName} />
      </div>
      <div>
        <Label htmlFor="motto">Playing motto</Label>
        <textarea
          id="motto"
          name="motto"
          rows={2}
          maxLength={160}
          defaultValue={values.motto}
          placeholder="Optional, e.g. Fold pre, win more"
          className="w-full resize-none rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-600 dark:border-neutral-700"
        />
      </div>
      <FormMessage error={state?.error} success={state?.success} />
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
