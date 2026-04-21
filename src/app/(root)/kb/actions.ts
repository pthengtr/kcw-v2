"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildKbEmbeddingInput,
  generateKbEmbedding,
  toPgVectorLiteral,
} from "@/lib/kb/embedding";

const KB_IMAGE_BUCKET = "kb-parts";

function toCleanString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function getFileExtension(filename: string): string {
  const clean = filename.trim().toLowerCase();
  const parts = clean.split(".");
  return parts.length > 1 ? parts.pop() || "bin" : "bin";
}

function getNextImageIndex(existingNames: string[]): number {
  const maxExisting = existingNames.reduce((max, name) => {
    const match = name.match(/^(\d{1,})/);
    if (!match) return max;
    const num = Number(match[1]);
    return Number.isFinite(num) ? Math.max(max, num) : max;
  }, 0);

  return maxExisting + 1;
}

function validateKbDraft({
  title,
  content,
}: {
  title: string;
  content: string;
}): string | null {
  if (!title) return "title_required";
  if (!content) return "content_required";
  return null;
}

export async function upsertKbPartAction(formData: FormData) {
  const supabase = await createClient();

  const idRaw = toCleanString(formData.get("id"));
  const title = toCleanString(formData.get("title"));
  const keywords = toCleanString(formData.get("keywords"));
  const content = toCleanString(formData.get("content"));
  const related = toCleanString(formData.get("related"));

  const validationError = validateKbDraft({ title, content });

  if (validationError) {
    if (idRaw) {
      redirect(`/kb?id=${idRaw}&error=${validationError}`);
    }
    redirect(`/kb?mode=new&error=${validationError}`);
  }

  const embeddingInput = buildKbEmbeddingInput({
    title,
    keywords,
  });

  const vector = embeddingInput
    ? await generateKbEmbedding(embeddingInput)
    : null;

  const payload = {
    title,
    keywords: keywords || null,
    content,
    related: related || null,
    embedding: vector ? toPgVectorLiteral(vector) : null,
  };

  if (idRaw) {
    const id = Number(idRaw);

    if (!Number.isFinite(id)) {
      redirect("/kb?error=invalid_id");
    }

    const { data, error } = await supabase
      .schema("kb")
      .from("kb_parts")
      .update(payload)
      .eq("id", id)
      .select("id")
      .single();

    if (error || !data) {
      console.error("upsertKbPartAction update error", error);
      redirect(`/kb?id=${id}&error=update_failed`);
    }

    revalidatePath("/kb");
    redirect(`/kb?id=${data.id}&saved=1`);
  }

  const { data, error } = await supabase
    .schema("kb")
    .from("kb_parts")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    console.error("upsertKbPartAction insert error", error);
    redirect("/kb?mode=new&error=create_failed");
  }

  revalidatePath("/kb");
  redirect(`/kb?id=${data.id}&created=1`);
}

export async function deleteKbPartAction(formData: FormData) {
  const supabase = await createClient();

  const idRaw = toCleanString(formData.get("id"));
  const id = Number(idRaw);

  if (!idRaw || !Number.isFinite(id)) {
    redirect("/kb?error=invalid_delete_id");
  }

  const folder = String(id);

  const { data: imageList } = await supabase.storage
    .from(KB_IMAGE_BUCKET)
    .list(folder, { limit: 100 });

  const imagePaths =
    imageList
      ?.filter((item) => !!item.name)
      .map((item) => `${folder}/${item.name}`) ?? [];

  if (imagePaths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(KB_IMAGE_BUCKET)
      .remove(imagePaths);

    if (storageError) {
      console.error("deleteKbPartAction storage delete error", storageError);
      redirect(`/kb?id=${id}&error=delete_failed`);
    }
  }

  const { error } = await supabase
    .schema("kb")
    .from("kb_parts")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("deleteKbPartAction error", error);
    redirect(`/kb?id=${id}&error=delete_failed`);
  }

  revalidatePath("/kb");
  redirect("/kb?deleted=1");
}

export async function uploadKbImagesAction(formData: FormData) {
  const supabase = await createClient();

  const idRaw = toCleanString(formData.get("id"));
  const id = Number(idRaw);

  if (!idRaw || !Number.isFinite(id)) {
    redirect("/kb?error=invalid_id");
  }

  const files = formData
    .getAll("images")
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);

  if (files.length === 0) {
    redirect(`/kb?id=${id}&error=no_images_selected`);
  }

  const { data: existingFiles, error: listError } = await supabase.storage
    .from(KB_IMAGE_BUCKET)
    .list(String(id), {
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

  if (listError) {
    console.error("uploadKbImagesAction list error", listError);
    redirect(`/kb?id=${id}&error=image_upload_failed`);
  }

  const nextIndex = getNextImageIndex(
    (existingFiles ?? []).map((item) => item.name),
  );

  for (let i = 0; i < files.length; i += 1) {
    const file = files[i];

    if (!file.type.startsWith("image/")) {
      redirect(`/kb?id=${id}&error=invalid_image_type`);
    }

    const ext = getFileExtension(file.name);
    const filename = `${String(nextIndex + i).padStart(3, "0")}.${ext}`;
    const path = `${id}/${filename}`;

    const { error: uploadError } = await supabase.storage
      .from(KB_IMAGE_BUCKET)
      .upload(path, file, {
        upsert: false,
        contentType: file.type || undefined,
      });

    if (uploadError) {
      console.error("uploadKbImagesAction upload error", uploadError);
      redirect(`/kb?id=${id}&error=image_upload_failed`);
    }
  }

  revalidatePath("/kb");
  redirect(`/kb?id=${id}&image_uploaded=1`);
}

export async function deleteKbImageAction(formData: FormData) {
  const supabase = await createClient();

  const idRaw = toCleanString(formData.get("id"));
  const path = toCleanString(formData.get("path"));
  const id = Number(idRaw);

  if (!idRaw || !Number.isFinite(id) || !path) {
    redirect("/kb?error=invalid_image_delete");
  }

  if (!path.startsWith(`${id}/`)) {
    redirect(`/kb?id=${id}&error=invalid_image_delete`);
  }

  const { error } = await supabase.storage.from(KB_IMAGE_BUCKET).remove([path]);

  if (error) {
    console.error("deleteKbImageAction error", error);
    redirect(`/kb?id=${id}&error=image_delete_failed`);
  }

  revalidatePath("/kb");
  redirect(`/kb?id=${id}&image_deleted=1`);
}
