import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KbEditorForm } from "./kb-editor-form";
import type { KbPartEditorItem } from "../types";

type KbEditorCardProps = {
  isNewMode: boolean;
  editorItem: KbPartEditorItem;
};

export function KbEditorCard({ isNewMode, editorItem }: KbEditorCardProps) {
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
          Images will live under <code>kb-parts/{"{faq_id}"}/</code>
        </CardDescription>
      </CardHeader>

      <CardContent>
        <KbEditorForm isNewMode={isNewMode} editorItem={editorItem} />
      </CardContent>
    </Card>
  );
}
