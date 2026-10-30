import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { readSession } from "@/lib/session";

/** The signed-in user, or a redirect to /login. Checks the DB so deleted users lose access. */
export const requireUser = cache(async () => {
  const session = await readSession();
  if (!session?.userId) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, username: true, displayName: true, role: true },
  });
  // The cookie is valid but the user is gone (deleted, or the DB was reset): drop the cookie too.
  if (!user) redirect("/auth/clear");
  return user;
});

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/");
  return user;
}
