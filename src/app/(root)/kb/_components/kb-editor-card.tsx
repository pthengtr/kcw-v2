import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KbEditorForm } from "./kb-editor-form";
import type { KbPartEditorItem, KbPartImage } from "../types";

type KbEditorCardProps = {
  isNewMode: boolean;
  editorItem: KbPartEditorItem;
  images: KbPartImage[];
};

export function KbEditorCard({
  isNewMode,
  editorItem,
  images,
}: KbEditorCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isNewMode
            ? "New FAQ"
            : editorItem?.id
              ? `Edit FAQ #${editorItem.id}`
              : "Editor"}
        </CardTitle>
        <CardDescription>
          Images live under <code>kb-parts/{"{faq_id}"}/</code>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <KbEditorForm
          isNewMode={isNewMode}
          editorItem={editorItem}
          images={images}
        />
      </CardContent>
    </Card>
  );
}
