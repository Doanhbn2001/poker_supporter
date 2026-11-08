import { HandImportPage } from "../../../../_games/hand-import-page";

export default async function Page({ params }: PageProps<"/tournaments/[id]/hands/import">) {
  return <HandImportPage id={(await params).id} type="CUP" />;
}
