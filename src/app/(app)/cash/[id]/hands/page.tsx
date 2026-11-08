import { HandsPage } from "../../../_games/hands-page";

export default async function Page({ params, searchParams }: PageProps<"/cash/[id]/hands">) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  return <HandsPage id={id} type="CASH" view={typeof q.view === "string" ? q.view : undefined} />;
}
