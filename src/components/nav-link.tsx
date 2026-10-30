"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const under = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/**
 * Top-bar link that highlights itself on its page and the pages below it (/cups also covers /cups/<id>).
 * `exact` matches only the href itself; `except` hands sub-paths to another link (e.g. /cups/new to "+ Cup").
 */
export function NavLink({
  href,
  exact = false,
  except = [],
  className = "",
  children,
}: {
  href: string;
  exact?: boolean;
  except?: string[];
  className?: string;
  children: React.ReactNode;
}) {
  const path = usePathname();
  const active = exact ? path === href : under(path, href) && !except.some((e) => under(path, e));

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`${className} ${
        active
          ? "font-semibold underline decoration-emerald-600 decoration-2 underline-offset-8"
          : "hover:text-neutral-900 dark:hover:text-white"
      }`}
    >
      {children}
    </Link>
  );
}
