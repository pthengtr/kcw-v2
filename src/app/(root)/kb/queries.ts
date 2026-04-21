import { createClient } from "@/lib/supabase/server";
import { generateKbEmbedding, toPgVectorLiteral } from "@/lib/kb/embedding";
import type {
  KbPartEditorItem,
  KbPartListItem,
  KbSemanticSearchResult,
} from "./types";

export async function getRecentKbParts(limit = 20): Promise<KbPartListItem[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("kb")
    .from("kb_parts")
    .select("id, title, keywords, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getRecentKbParts error", error);
    return [];
  }

  return (data ?? []) as KbPartListItem[];
}

export async function fixedTermSearchKbParts(
  term: string,
  limit = 20,
): Promise<KbPartListItem[]> {
  const q = term.trim();
  if (!q) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("kb")
    .from("kb_parts")
    .select("id, title, keywords, updated_at")
    .or(
      [
        `title.ilike.%${q}%`,
        `keywords.ilike.%${q}%`,
        `content.ilike.%${q}%`,
        `related.ilike.%${q}%`,
      ].join(","),
    )
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("fixedTermSearchKbParts error", error);
    return [];
  }

  return (data ?? []) as KbPartListItem[];
}

export async function semanticSearchKbParts(
  term: string,
  limit = 10,
): Promise<KbSemanticSearchResult[]> {
  const q = term.trim();
  if (!q) return [];

  const embedding = await generateKbEmbedding(q);
  const supabase = await createClient();

  const { data, error } = await supabase.schema("kb").rpc("match_kb_parts", {
    query_embedding: toPgVectorLiteral(embedding),
    match_count: limit,
  });

  if (error) {
    console.error("semanticSearchKbParts error", error);
    return [];
  }

  return (data ?? []) as KbSemanticSearchResult[];
}

export async function getKbPartById(id: number): Promise<KbPartEditorItem> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .schema("kb")
    .from("kb_parts")
    .select("id, title, keywords, content, related, updated_at")
    .eq("id", id)
    .single();

  if (error) {
    console.error("getKbPartById error", error);
    return null;
  }

  return data as KbPartEditorItem;
}
