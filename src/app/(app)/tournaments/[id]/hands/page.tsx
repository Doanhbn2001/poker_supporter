import { HandsPage } from "../../../_games/hands-page";

export default async function Page({ params, searchParams }: PageProps<"/tournaments/[id]/hands">) {
  const [{ id }, q] = await Promise.all([params, searchParams]);
  return <HandsPage id={id} type="CUP" view={typeof q.view === "string" ? q.view : undefined} />;
}
