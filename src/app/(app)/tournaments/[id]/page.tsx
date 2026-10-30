import { GameDetailPage } from "../../_games/detail-page";

export default async function Page({ params }: PageProps<"/tournaments/[id]">) {
  return <GameDetailPage id={(await params).id} type="CUP" />;
}
