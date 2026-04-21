import {
  getRecentKbParts,
  fixedTermSearchKbParts,
  semanticSearchKbParts,
  getKbPartById,
  listKbPartImages,
} from "./queries";
import { KbAdminScreen } from "./_components/kb-admin-screen";
import type { KbSearchParams } from "./types";

type PageProps = {
  searchParams?: Promise<KbSearchParams>;
};

export default async function KbPage({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const fixedQuery = params.fixed_q?.trim() ?? "";
  const semanticQuery = params.semantic_q?.trim() ?? "";
  const mode = params.mode?.trim() ?? "";
  const selectedId = params.id ? Number(params.id) : null;

  const [
    recentItems,
    fixedResults,
    semanticResults,
    selectedItem,
    editorImages,
  ] = await Promise.all([
    getRecentKbParts(20),
    fixedQuery ? fixedTermSearchKbParts(fixedQuery, 20) : Promise.resolve([]),
    semanticQuery
      ? semanticSearchKbParts(semanticQuery, 10)
      : Promise.resolve([]),
    Number.isFinite(selectedId) && selectedId
      ? getKbPartById(selectedId)
      : Promise.resolve(null),
    Number.isFinite(selectedId) && selectedId && mode !== "new"
      ? listKbPartImages(selectedId)
      : Promise.resolve([]),
  ]);

  const isNewMode = mode === "new";
  const editorItem = isNewMode
    ? { id: undefined, title: "", keywords: "", content: "", related: "" }
    : selectedItem;

  return (
    <KbAdminScreen
      recentItems={recentItems}
      fixedResults={fixedResults}
      semanticResults={semanticResults}
      fixedQuery={fixedQuery}
      semanticQuery={semanticQuery}
      selectedId={selectedId}
      isNewMode={isNewMode}
      editorItem={editorItem}
      editorImages={editorImages}
      status={{
        created: params.created,
        saved: params.saved,
        deleted: params.deleted,
        image_uploaded: params.image_uploaded,
        image_deleted: params.image_deleted,
        error: params.error,
      }}
    />
  );
}
