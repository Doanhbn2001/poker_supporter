"use client";

import { useActionState } from "react";
import { changePassword } from "@/app/actions/players";
import { Button, FormMessage, Input, Label } from "@/components/ui";

export function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);

  return (
    <form action={action} className="space-y-4" key={state?.success}>
      <div>
        <Label htmlFor="current">Current password</Label>
        <Input id="current" name="current" type="password" autoComplete="current-password" required />
      </div>
      <div>
        <Label htmlFor="next">New password</Label>
        <Input id="next" name="next" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      <FormMessage error={state?.error} success={state?.success} />
      <Button type="submit" disabled={pending}>
        Change password
      </Button>
    </form>
  );
}
