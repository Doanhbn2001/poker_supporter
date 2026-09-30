import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { requireUser } from "@/lib/dal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
          <Link href="/" className="font-semibold">
            ♠ Poker Supporter
          </Link>
          <Link href="/">Dashboard</Link>
          <Link href="/sessions">Sessions</Link>
          <Link href="/players">Players</Link>
          <Link href="/sessions/new" className="font-medium text-emerald-600">
            + Log session
          </Link>
          <span className="ml-auto flex items-center gap-4">
            <Link href="/account" className="text-neutral-500">
              {user.displayName}
            </Link>
            <form action={logout}>
              <button className="text-neutral-500 hover:underline">Log out</button>
            </form>
          </span>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
