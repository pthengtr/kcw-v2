"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { deleteKbPartAction, upsertKbPartAction } from "../actions";
import type { KbPartEditorItem, KbPartImage } from "../types";
import { KbImageManager } from "./kb-image-manager";
import { KbSubmitButton } from "./kb-submit-button";
import { KbConfirmSubmitButton } from "./kb-confirm-submit-button";

type KbEditorFormProps = {
  isNewMode: boolean;
  editorItem: KbPartEditorItem;
  images: KbPartImage[];
};

type FormErrors = {
  title?: string;
  content?: string;
};

function validateDraft(form: HTMLFormElement): FormErrors {
  const formData = new FormData(form);

  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();

  const errors: FormErrors = {};

  if (!title) {
    errors.title = "กรุณากรอกชื่อ FAQ";
  }

  if (!content) {
    errors.content = "กรุณากรอกเนื้อหา FAQ";
  }

  return errors;
}

export function KbEditorForm({
  isNewMode,
  editorItem,
  images,
}: KbEditorFormProps) {
  const isEditorActive = isNewMode || !!editorItem;
  const [errors, setErrors] = useState<FormErrors>({});

  const formKey = isNewMode
    ? "kb-form-new"
    : `kb-form-${editorItem?.id ?? "empty"}`;

  useEffect(() => {
    setErrors({});
  }, [formKey]);

  if (!isEditorActive) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        กรุณาเลือก FAQ จากด้านซ้าย หรือกด <strong>สร้าง FAQ ใหม่</strong>
      </div>
    );
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    const nextErrors = validateDraft(form);

    if (nextErrors.title || nextErrors.content) {
      e.preventDefault();
      setErrors(nextErrors);
      return;
    }

    setErrors({});
  }

  function clearFieldError(field: keyof FormErrors) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      return { ...prev, [field]: undefined };
    });
  }

  return (
    <div className="space-y-4">
      <form
        key={formKey}
        action={upsertKbPartAction}
        className="space-y-4"
        noValidate
        onSubmit={handleSubmit}
      >
        <input type="hidden" name="id" value={editorItem?.id ?? ""} />

        <div className="space-y-2">
          <label className="text-sm font-medium">
            ชื่อ FAQ <span className="text-destructive">*</span>
          </label>
          <Input
            name="title"
            placeholder="เช่น วิธีเช็คราคาสินค้า"
            defaultValue={editorItem?.title ?? ""}
            maxLength={255}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "kb-title-error" : undefined}
            className={
              errors.title
                ? "border-destructive focus-visible:ring-destructive"
                : ""
            }
            onInput={(e) => {
              const value = e.currentTarget.value.trim();
              if (value) clearFieldError("title");
            }}
          />
          {errors.title ? (
            <p id="kb-title-error" className="text-sm text-destructive">
              {errors.title}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">คีย์เวิร์ด</label>
          <Input
            name="keywords"
            placeholder="เช่น ราคา, สต๊อก, สินค้า"
            defaultValue={editorItem?.keywords ?? ""}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">
            เนื้อหา <span className="text-destructive">*</span>
          </label>
          <textarea
            name="content"
            className={`min-h-[180px] w-full rounded-md border bg-background px-3 py-2 text-sm ${
              errors.content
                ? "border-destructive focus:outline-none focus:ring-2 focus:ring-destructive"
                : ""
            }`}
            placeholder="กรอกคำตอบหรือรายละเอียด FAQ"
            defaultValue={editorItem?.content ?? ""}
            aria-invalid={!!errors.content}
            aria-describedby={errors.content ? "kb-content-error" : undefined}
            onInput={(e) => {
              const value = e.currentTarget.value.trim();
              if (value) clearFieldError("content");
            }}
          />
          {errors.content ? (
            <p id="kb-content-error" className="text-sm text-destructive">
              {errors.content}
            </p>
          ) : null}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">ข้อมูลที่เกี่ยวข้อง</label>
          <textarea
            name="related"
            className="min-h-[100px] w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="ข้อมูลเสริม / คำค้นที่เกี่ยวข้อง / หมายเหตุ"
            defaultValue={editorItem?.related ?? ""}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href="/kb?mode=new">ล้างฟอร์ม</Link>
          </Button>

          <KbSubmitButton
            type="submit"
            idleText={editorItem?.id ? "บันทึก FAQ" : "สร้าง FAQ"}
            pendingText={editorItem?.id ? "กำลังบันทึก..." : "กำลังสร้าง..."}
          />
        </div>
      </form>

      <KbImageManager faqId={editorItem?.id} images={images} />

      {!!editorItem?.id && (
        <>
          <form
            id={`kb-delete-faq-${editorItem.id}`}
            action={deleteKbPartAction}
          >
            <input type="hidden" name="id" value={editorItem.id} />
          </form>

          <KbConfirmSubmitButton
            formId={`kb-delete-faq-${editorItem.id}`}
            triggerText="ลบ FAQ"
            confirmText="ยืนยันการลบ FAQ"
            title="ลบ FAQ นี้ใช่หรือไม่?"
            description="การลบนี้ไม่สามารถย้อนกลับได้ และรูปภาพในรายการนี้จะถูกลบด้วย"
            variant="destructive"
          />
        </>
      )}
    </div>
  );
}
