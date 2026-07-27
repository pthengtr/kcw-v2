import { KbEditorCard } from "./kb-editor-card";
import { KbFixedSearchCard } from "./kb-fixed-search-card";
import { KbRecentList } from "./kb-recent-list";
import { KbSemanticSearchCard } from "./kb-semantic-search-card";
import { KbStatusBanner } from "./kb-status-banner";
import type { KbAdminScreenProps } from "../types";
import BackButton from "@/components/common/BackButton";

export function KbAdminScreen({
  recentItems,
  fixedResults,
  semanticResults,
  fixedQuery,
  semanticQuery,
  selectedId,
  isNewMode,
  editorItem,
  editorImages,
  status,
}: KbAdminScreenProps) {
  return (
    <div className="space-y-6 p-3 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
        <BackButton href="/home" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            จัดการ FAQ
          </h1>
          <p className="text-sm text-muted-foreground">
            จัดการข้อมูล <code>kb.kb_parts</code>{" "}
            พร้อมทดสอบการค้นหาแบบคำตรงและแบบความหมาย
          </p>
        </div>
      </div>

      <KbStatusBanner {...status} />

      <div className="grid min-w-0 gap-6 xl:grid-cols-[320px_minmax(0,1fr)_420px]">
        <KbRecentList
          recentItems={recentItems}
          selectedId={selectedId}
          isNewMode={isNewMode}
        />

        <KbEditorCard
          isNewMode={isNewMode}
          editorItem={editorItem}
          images={editorImages}
        />

        <div className="space-y-6">
          <KbFixedSearchCard
            fixedQuery={fixedQuery}
            fixedResults={fixedResults}
          />
          <KbSemanticSearchCard
            semanticQuery={semanticQuery}
            semanticResults={semanticResults}
          />
        </div>
      </div>
    </div>
  );
}
