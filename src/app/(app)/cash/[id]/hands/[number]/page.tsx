import { HandPage } from "../../../../_games/hand-page";

export default async function Page({ params }: PageProps<"/cash/[id]/hands/[number]">) {
  const { id, number } = await params;
  return <HandPage id={id} type="CASH" number={number} />;
}
