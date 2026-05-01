import { createAdminClient } from "@/lib/supabase/admin";
import type { ProductImageSlot, ProductInfo } from "./types";

export const PRODUCT_IMAGE_BUCKET = "pictures";
export const PRODUCT_IMAGE_BASE_FOLDER = "product";
export const MAX_PRODUCT_IMAGES = 5;

export function normalizeBcode(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function getExpectedProductImageFilenames(bcode: string): string[] {
  const clean = normalizeBcode(bcode);

  return [
    `${clean}.jpg`,
    `${clean}_1.jpg`,
    `${clean}_2.jpg`,
    `${clean}_3.jpg`,
    `${clean}_4.jpg`,
  ];
}

export function getProductImageFolder(bcode: string): string {
  return `${PRODUCT_IMAGE_BASE_FOLDER}/${normalizeBcode(bcode)}`;
}

export function getExpectedProductImagePaths(bcode: string): string[] {
  const folder = getProductImageFolder(bcode);
  return getExpectedProductImageFilenames(bcode).map(
    (name) => `${folder}/${name}`,
  );
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function getVersion(item: {
  updated_at?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return (
    item.updated_at ??
    item.created_at ??
    String(item.metadata?.lastModified ?? Date.now())
  );
}

export async function getProductByBcode(
  bcode: string,
): Promise<ProductInfo | null> {
  const clean = normalizeBcode(bcode);
  if (!clean) return null;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("v_pos_products_hq")
    .select("BCODE, DESCR, MODEL, BRAND, PRICE1")
    .eq("BCODE", clean)
    .maybeSingle();

  if (error) {
    console.error("getProductByBcode error", error);
    return null;
  }

  return (data ?? null) as ProductInfo | null;
}

export async function listProductImageSlots(
  bcode: string,
): Promise<ProductImageSlot[]> {
  const clean = normalizeBcode(bcode);
  if (!clean) return [];

  const supabase = createAdminClient();
  const folder = getProductImageFolder(clean);
  const expectedNames = getExpectedProductImageFilenames(clean);

  const { data, error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .list(folder, {
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "asc" },
    });

  if (error) {
    console.error("listProductImageSlots error", {
      folder,
      error,
    });
  }

  const items = (data ?? []).filter((item) => {
    if (!item.name) return false;
    if (item.id === null) return false;
    return expectedNames.includes(item.name);
  });

  const byName = new Map(items.map((item) => [item.name, item]));

  const existingItems = expectedNames
    .map((name) => byName.get(name))
    .filter(Boolean);

  const oldestName =
    existingItems.length >= MAX_PRODUCT_IMAGES
      ? ([...existingItems].sort((a, b) => {
          const aTime = a?.updated_at ?? a?.created_at ?? "";
          const bTime = b?.updated_at ?? b?.created_at ?? "";
          return aTime.localeCompare(bTime);
        })[0]?.name ?? null)
      : null;

  return expectedNames.map((filename, index) => {
    const item = byName.get(filename);
    const path = `${folder}/${filename}`;

    if (!item) {
      return {
        slotNo: index + 1,
        label: index === 0 ? "รูปหลัก" : `รูป ${index + 1}`,
        filename,
        path,
        exists: false,
        publicUrl: null,
        createdAt: null,
        updatedAt: null,
        size: null,
        isOldest: false,
      };
    }

    const { data: publicUrlData } = supabase.storage
      .from(PRODUCT_IMAGE_BUCKET)
      .getPublicUrl(path);

    const version = getVersion(item);

    return {
      slotNo: index + 1,
      label: index === 0 ? "รูปหลัก" : `รูป ${index + 1}`,
      filename,
      path,
      exists: true,
      publicUrl: `${publicUrlData.publicUrl}?v=${encodeURIComponent(version)}`,
      createdAt: item.created_at ?? null,
      updatedAt: item.updated_at ?? null,
      size: toNumberOrNull(item.metadata?.size),
      isOldest: item.name === oldestName,
    };
  });
}

export function selectAutoUploadSlot(
  slots: ProductImageSlot[],
): ProductImageSlot | null {
  const emptySlot = slots.find((slot) => !slot.exists);
  if (emptySlot) return emptySlot;

  const existingSlots = slots.filter((slot) => slot.exists);
  if (existingSlots.length === 0) return slots[0] ?? null;

  return [...existingSlots].sort((a, b) => {
    const aTime = a.updatedAt ?? a.createdAt ?? "";
    const bTime = b.updatedAt ?? b.createdAt ?? "";
    return aTime.localeCompare(bTime);
  })[0];
}
