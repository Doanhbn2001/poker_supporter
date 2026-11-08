import { HandPage } from "../../../../_games/hand-page";

export default async function Page({ params }: PageProps<"/tournaments/[id]/hands/[number]">) {
  const { id, number } = await params;
  return <HandPage id={id} type="CUP" number={number} />;
}
