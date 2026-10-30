import type { ComponentProps } from "react";
import { formatMoney } from "@/lib/money";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "rounded-xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900",
        className,
      )}
      {...props}
    />
  );
}

/** Card for a table that can grow long: scrolls inside after ~12 rows and keeps the header row in view. */
// Not built on Card: Card's p-5 would win over p-0 (Tailwind orders utilities by its own CSS order, not by
// class order), and that padding would leave a gap above the sticky header for rows to show through.
export function TableCard({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx(
        "max-h-[32rem] overflow-auto rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900",
        "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10 [&_thead]:bg-white dark:[&_thead]:bg-neutral-900",
        className,
      )}
      {...props}
    />
  );
}

export function Button({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      className={cx(
        "rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cx(
        "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-600 dark:border-neutral-700",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cx(
        "w-full rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-emerald-600 dark:border-neutral-700 dark:bg-neutral-900",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: ComponentProps<"label">) {
  return <label className={cx("mb-1 block text-sm font-medium", className)} {...props} />;
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (success) return <p className="text-sm text-emerald-600">{success}</p>;
  return null;
}

export function Money({ cents }: { cents: number }) {
  const color = cents > 0 ? "text-emerald-600" : cents < 0 ? "text-red-600" : "";
  return <span className={cx("tabular-nums", color)}>{formatMoney(cents, { signed: true })}</span>;
}
