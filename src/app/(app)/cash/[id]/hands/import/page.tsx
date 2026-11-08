import { HandImportPage } from "../../../../_games/hand-import-page";

export default async function Page({ params }: PageProps<"/cash/[id]/hands/import">) {
  return <HandImportPage id={(await params).id} type="CASH" />;
}
