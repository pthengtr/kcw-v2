"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  buildKbEmbeddingInput,
  generateKbEmbedding,
  toPgVectorLiteral,
} from "@/lib/kb/embedding";

function toCleanString(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function upsertKbPartAction(formData: FormData) {
  const supabase = await createClient();

  const idRaw = toCleanString(formData.get("id"));
  const title = toCleanString(formData.get("title"));
  const keywords = toCleanString(formData.get("keywords"));
  const content = toCleanString(formData.get("content"));
  const related = toCleanString(formData.get("related"));

  const embeddingInput = buildKbEmbeddingInput({
    title,
    keywords,
    content,
    related,
  });

  let embedding: string | null = null;

  if (embeddingInput) {
    const vector = await generateKbEmbedding(embeddingInput);
    embedding = toPgVectorLiteral(vector);
  }

  const payload = {
    title: title || null,
    keywords: keywords || null,
    content: content || null,
    related: related || null,
    embedding,
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
