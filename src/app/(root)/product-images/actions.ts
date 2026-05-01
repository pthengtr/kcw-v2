"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  PRODUCT_IMAGE_BUCKET,
  getExpectedProductImagePaths,
  listProductImageSlots,
  normalizeBcode,
  selectAutoUploadSlot,
} from "./queries";

function clean(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function redirectBack(bcode: string, params: Record<string, string>): never {
  const query = new URLSearchParams({
    bcode,
    ...params,
  });

  redirect(`/product-images?${query.toString()}`);
}

function isValidProductImagePath(bcode: string, path: string): boolean {
  return getExpectedProductImagePaths(bcode).includes(path);
}

async function uploadToPath({
  bcode,
  path,
  file,
}: {
  bcode: string;
  path: string;
  file: File;
}) {
  if (!bcode) {
    redirect("/product-images?error=missing_bcode");
  }

  if (!file || file.size <= 0) {
    redirectBack(bcode, { error: "no_file" });
  }

  if (!file.type.startsWith("image/")) {
    redirectBack(bcode, { error: "invalid_file_type" });
  }

  if (!isValidProductImagePath(bcode, path)) {
    redirectBack(bcode, { error: "invalid_slot" });
  }

  const supabase = createAdminClient();

  const arrayBuffer = await file.arrayBuffer();

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, arrayBuffer, {
      upsert: true,
      contentType: file.type || "image/jpeg",
      cacheControl: "3600",
    });

  if (error) {
    console.error("upload product image error", {
      path,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      error,
    });
    redirectBack(bcode, { error: "upload_failed" });
  }

  revalidatePath("/product-images");
}

export async function uploadProductImageAutoAction(formData: FormData) {
  const bcode = normalizeBcode(clean(formData.get("bcode")));
  const file = formData.get("image");

  if (!bcode) {
    redirect("/product-images?error=missing_bcode");
  }

  if (!(file instanceof File)) {
    redirectBack(bcode, { error: "no_file" });
  }

  const slots = await listProductImageSlots(bcode);
  const targetSlot = selectAutoUploadSlot(slots);

  if (!targetSlot) {
    redirectBack(bcode, { error: "no_slot" });
  }

  const selectedSlot = targetSlot;
  const wasReplace = selectedSlot.exists;

  await uploadToPath({
    bcode,
    path: selectedSlot.path,
    file,
  });

  redirectBack(bcode, {
    saved: "1",
    slot: String(selectedSlot.slotNo),
    mode: wasReplace ? "replaced_oldest" : "filled_empty",
  });
}

export async function replaceProductImageSlotAction(formData: FormData) {
  const bcode = normalizeBcode(clean(formData.get("bcode")));
  const path = clean(formData.get("path"));
  const slotNo = clean(formData.get("slotNo"));
  const file = formData.get("image");

  if (!bcode) redirect("/product-images?error=missing_bcode");
  if (!(file instanceof File)) redirectBack(bcode, { error: "no_file" });

  await uploadToPath({
    bcode,
    path,
    file,
  });

  redirectBack(bcode, {
    saved: "1",
    slot: slotNo || "unknown",
    mode: "replace_slot",
  });
}

export async function deleteProductImageSlotAction(formData: FormData) {
  const bcode = normalizeBcode(clean(formData.get("bcode")));
  const path = clean(formData.get("path"));
  const slotNo = clean(formData.get("slotNo"));

  if (!bcode) redirect("/product-images?error=missing_bcode");

  if (!path || !isValidProductImagePath(bcode, path)) {
    redirectBack(bcode, { error: "invalid_delete" });
  }

  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .remove([path]);

  if (error) {
    console.error("delete product image error", error);
    redirectBack(bcode, { error: "delete_failed" });
  }

  revalidatePath("/product-images");

  redirectBack(bcode, {
    deleted: "1",
    slot: slotNo || "unknown",
  });
}
