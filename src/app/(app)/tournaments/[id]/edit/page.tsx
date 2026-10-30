import { GameEditPage } from "../../../_games/edit-page";

export default async function Page({ params }: PageProps<"/tournaments/[id]/edit">) {
  return <GameEditPage id={(await params).id} type="CUP" />;
}
