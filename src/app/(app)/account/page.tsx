import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";

/** Account settings now live on the player's own profile page; keep old links working. */
export default async function AccountPage() {
  const me = await requireUser();
  redirect(`/players/${me.id}#account`);
}
