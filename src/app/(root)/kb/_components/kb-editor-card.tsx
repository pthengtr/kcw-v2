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
            ? "สร้าง FAQ ใหม่"
            : editorItem?.id
              ? `แก้ไข FAQ #${editorItem.id}`
              : "แก้ไข FAQ"}
        </CardTitle>
        <CardDescription>
          รูปภาพจะถูกเก็บไว้ที่ <code>kb-parts/{"{faq_id}"}/</code>
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
