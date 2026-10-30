"use client";

import { useTransition } from "react";

export function DeleteGameButton({ noun, action }: { noun: string; action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      className="font-medium text-red-600 hover:underline disabled:opacity-50"
      onClick={() => {
        if (confirm(`Delete this ${noun}? This can't be undone.`)) startTransition(() => action());
      }}
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
