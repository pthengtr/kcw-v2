import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deleteKbPartAction, upsertKbPartAction } from "../actions";
import type { KbPartEditorItem, KbPartImage } from "../types";
import { KbImageManager } from "./kb-image-manager";

type KbEditorFormProps = {
  isNewMode: boolean;
  editorItem: KbPartEditorItem;
  images: KbPartImage[];
};

export function KbEditorForm({
  isNewMode,
  editorItem,
  images,
}: KbEditorFormProps) {
  const isEditorActive = isNewMode || !!editorItem;

  if (!isEditorActive) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        Select an existing FAQ from the left, or click <strong>New FAQ</strong>.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form action={upsertKbPartAction} className="space-y-4">
        <input type="hidden" name="id" value={editorItem?.id ?? ""} />

        <div className="space-y-2">
          <label className="text-sm font-medium">Title</label>
          <Input
            name="title"
            placeholder="FAQ title"
            defaultValue={editorItem?.title ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Keywords</label>
          <Input
            name="keywords"
            placeholder="comma separated keywords"
            defaultValue={editorItem?.keywords ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Content</label>
          <textarea
            name="content"
            className="min-h-[180px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="FAQ content"
            defaultValue={editorItem?.content ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Related</label>
          <textarea
            name="related"
            className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="related text / hints"
            defaultValue={editorItem?.related ?? ""}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/kb?mode=new">Reset to new</Link>
          </Button>

          <Button type="submit">
            {editorItem?.id ? "Save FAQ" : "Create FAQ"}
          </Button>
        </div>
      </form>

      <KbImageManager faqId={editorItem?.id} images={images} />

      {!!editorItem?.id && (
        <form action={deleteKbPartAction}>
          <input type="hidden" name="id" value={editorItem.id} />
          <Button type="submit" variant="destructive">
            Delete FAQ
          </Button>
        </form>
      )}
    </div>
  );
}
