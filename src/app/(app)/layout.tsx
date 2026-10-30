import Link from "next/link";
import { logout } from "@/app/actions/auth";
import { NavLink } from "@/components/nav-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { requireUser } from "@/lib/dal";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3 text-sm">
          <Link href="/" className="font-semibold">
            ♠ Poker Supporter
          </Link>
          <NavLink href="/" exact>Dashboard</NavLink>
          <NavLink href="/tournaments" except={["/tournaments/new"]}>Tournaments</NavLink>
          <NavLink href="/cash" except={["/cash/new"]}>Cash</NavLink>
          <NavLink href="/fund">Fund</NavLink>
          <NavLink href="/players">Players</NavLink>
          <NavLink href="/guide">Guide</NavLink>
          <NavLink href="/tips">Tips</NavLink>
          {user.role === "ADMIN" && (
            <>
              <NavLink href="/tournaments/new" exact className="font-medium text-emerald-600">
                + Tour
              </NavLink>
              <NavLink href="/cash/new" exact className="font-medium text-emerald-600">
                + Cash
              </NavLink>
            </>
          )}
          <span className="ml-auto flex items-center gap-4">
            <ThemeToggle />
            <NavLink href="/account" className="text-neutral-500">
              {user.displayName}
            </NavLink>
            <form action={logout}>
              <button className="text-neutral-500 hover:underline">Log out</button>
            </form>
          </span>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
