"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { Button, FormMessage, Input, Label } from "@/components/ui";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label htmlFor="username">Username</Label>
        <Input id="username" name="username" autoComplete="username" autoCapitalize="none" required
          defaultValue={state?.username} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormMessage error={state?.error} />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
